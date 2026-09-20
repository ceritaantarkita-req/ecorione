import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PCS-08 GitHub-to-staging CD contract", () => {
  const workflow = readFileSync(".github/workflows/staging-deploy.yml", "utf8");
  const forcedCommand = readFileSync("scripts/staging-cd-forced-command.sh", "utf8");
  const rootDeploy = readFileSync("scripts/staging-cd-root-deploy.sh", "utf8");
  const bootstrap = readFileSync("scripts/staging-cd-host-bootstrap.sh", "utf8");

  it("deploys only a current main SHA after both required gates are green", () => {
    expect(workflow).toContain('workflows: ["CI", "Product Eval"]');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("commits/main");
    expect(workflow).toContain(
      '"repos/${GITHUB_REPOSITORY}/actions/workflows/${workflow_file}/runs"',
    );
    expect(workflow).toContain("gate_success ci.yml");
    expect(workflow).toContain("gate_success product-eval.yml");
    expect(workflow).toContain('select(.conclusion == "success")');
    expect(workflow).toContain("Skipping stale SHA");
  });

  it("keeps staging SSH material in the protected staging environment", () => {
    expect(workflow).toContain("environment: staging");
    expect(workflow).toContain("vars.ECORIONE_STAGING_CD_ENABLED == '1'");
    expect(workflow).toContain("secrets.STAGING_SSH_PRIVATE_KEY");
    expect(workflow).toContain("secrets.STAGING_SSH_KNOWN_HOSTS");
    expect(workflow).toContain("secrets.STAGING_SSH_HOST");
    expect(workflow).toContain("secrets.STAGING_SSH_USER");
    expect(workflow).toContain("StrictHostKeyChecking=yes");
    expect(workflow).toContain("IdentitiesOnly=yes");
    expect(workflow).not.toContain("ssh-keyscan");
  });

  it("sends only an exact deploy command over SSH", () => {
    expect(workflow).toContain('"deploy $TARGET_SHA"');
    expect(forcedCommand).toContain("^deploy[[:space:]]([0-9a-f]{40})$");
    expect(forcedCommand).toContain(
      'exec sudo -n /usr/local/sbin/ecorione-staging-deploy "${BASH_REMATCH[1]}"',
    );
    expect(forcedCommand).not.toContain("eval ");
  });

  it("does not use a blind polling git pull loop", () => {
    expect(workflow).not.toContain("git pull");
    expect(forcedCommand).not.toContain("git pull");
    expect(rootDeploy).not.toContain("git pull");
    expect(rootDeploy).toContain("owner_git fetch origin main --prune");
    expect(rootDeploy).toContain('[[ "$TARGET_SHA" == "$REMOTE_MAIN" ]]');
  });

  it("serializes deploys and records exact release identity", () => {
    expect(rootDeploy).toContain("flock -n 9");
    expect(rootDeploy).toContain("deploy-state.env");
    expect(rootDeploy).toContain("current_sha=");
    expect(rootDeploy).toContain("current_tag=");
    expect(rootDeploy).toContain("previous_sha=");
    expect(rootDeploy).toContain("previous_tag=");
  });

  it(
    "requires preflight, runtime health, public smoke, ops health, and exact-host evidence",
    () => {
      expect(rootDeploy).toContain("scripts/production-preflight.sh");
      expect(rootDeploy).toContain("scripts/self-host-upgrade.sh");
      expect(rootDeploy).toContain("wait_for_services");
      expect(rootDeploy).toContain("scripts/production-public-smoke.mjs");
      expect(rootDeploy).toContain("scripts/production-ops-snapshot.mjs");
      expect(rootDeploy).toContain("scripts/staging-host-evidence.mjs");
      expect(rootDeploy).toContain('ECORIONE_EXPECTED_SHA="$TARGET_SHA"');
    },
  );

  it(
    "fails the release and attempts known-good rollback when a post-deploy gate fails",
    () => {
      expect(rootDeploy).toContain("rollback()");
      expect(rootDeploy).toContain("scripts/self-host-rollback.sh");
      expect(rootDeploy).toContain('owner_git checkout --detach "$PREVIOUS_SHA"');
      expect(rootDeploy).toContain("Rollback verified at basic public boundary");
      expect(rootDeploy).toContain("ROLLBACK FAILED; operator intervention required");
    },
  );

  it(
    "bootstraps a dedicated forced-command SSH user without Docker-group membership",
    () => {
      expect(bootstrap).toContain("DEPLOY_USER=ecorione-deploy");
      expect(bootstrap).toContain(
        'restrict,command="/usr/local/sbin/ecorione-staging-deploy-gate"',
      );
      expect(bootstrap).toContain("/etc/sudoers.d/ecorione-staging-deploy");
      expect(bootstrap).toContain("visudo -cf");
      expect(bootstrap).toContain(
        "No Docker-group membership was added to the deploy user.",
      );
      expect(bootstrap).not.toContain("usermod -aG docker");
    },
  );
});
