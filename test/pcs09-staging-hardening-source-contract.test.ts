import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

describe("PCS-09 staging hardening source contract", () => {
  it("captures sanitized host/runtime/security facts without reading secret values", () => {
    const source = readFileSync(
      resolve(ROOT, "scripts/staging-pcs09-inventory.mjs"),
      "utf8",
    );
    expect(source).toContain("restartPolicy");
    expect(source).toContain("unless-stopped");
    expect(source).toContain("publishedPorts");
    expect(source).toContain("dockerEnabledAtBoot");
    expect(source).toContain("ufwActive");
    expect(source).toContain("passwordAuthentication");
    expect(source).toContain("permitRootLogin");
    expect(source).toContain("availableDiskGiB");
    expect(source).toContain("availableMemoryMiB");
    expect(source).toContain("connect-runtime-settings.json");
    expect(source).toContain("connect-credentials.vault.json");
    expect(source).toContain("No env values, credential plaintext");
    expect(source).not.toContain("cat deploy/staging.env");
    expect(source).not.toContain("docker system prune");
    expect(source).not.toContain("docker volume prune");
  });

  it("requires a real VPS reboot and preserves present Connect durable files", () => {
    const source = readFileSync(
      resolve(ROOT, "scripts/staging-pcs09-restart-evidence.mjs"),
      "utf8",
    );
    expect(source).toContain("/proc/sys/kernel/random/boot_id");
    expect(source).toContain("Linux boot_id did not change");
    expect(source).toContain(
      "Connect durable-file fingerprints changed across reboot",
    );
    expect(source).toContain("production-public-smoke.mjs");
    expect(source).toContain("production-ops-snapshot.mjs");
    expect(source).toContain("staging-host-evidence.mjs");
    expect(source).toContain("PASS PCS-09 VPS reboot persistence evidence");
  });

  it("hardens SSH without disabling operator public-key authentication", () => {
    const source = readFileSync(
      resolve(ROOT, "scripts/staging-ssh-hardening.sh"),
      "utf8",
    );
    expect(source).toContain("00-ecorione-staging-hardening.conf");
    expect(source).toContain("PubkeyAuthentication yes");
    expect(source).toContain("PasswordAuthentication no");
    expect(source).toContain("KbdInteractiveAuthentication no");
    expect(source).toContain("PermitRootLogin no");
    expect(source).toContain("sshd -t");
    expect(source).toContain("keep this session open");
    expect(source).not.toContain("ufw reset");
  });

  it("uses a cold same-host backup with isolated verification and guaranteed restart cleanup", () => {
    const source = readFileSync(
      resolve(ROOT, "scripts/staging-pcs09-backup.sh"),
      "utf8",
    );
    expect(source).toContain("--apply");
    expect(source).toContain("Release receipt must be root-owned");
    expect(source).toContain("compose stop");
    expect(source).toContain("trap cleanup EXIT");
    expect(source).toContain("fingerprint_volume");
    expect(source).toContain("docker volume create");
    expect(source).toContain("isolated content verification");
    expect(source).toContain("NOT off-host disaster recovery");
    expect(source).toContain("Connect Vault master key");
    expect(source).not.toContain("docker system prune");
    expect(source).not.toContain("docker volume prune");
  });
});
