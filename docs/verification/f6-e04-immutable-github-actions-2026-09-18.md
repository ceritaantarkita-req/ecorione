# F6-E04 — Immutable GitHub Actions Pinning

Date: **2026-09-18**

Status: **CLOSED / REPO-SIDE PASS**

## Scope

F6-E04 closes a repository supply-chain governance gap: remote actions in GitHub workflow YAML were referenced through mutable tags such as `@v5` and `@v4`.

The implementation:

1. adds `scripts/github-actions-pin-review.mjs`;
2. discovers every tracked YAML file under `.github/workflows`;
3. rejects remote `uses:` targets unless the ref is a full 40-character commit SHA;
4. allows repository-local actions and `docker://` targets because they are outside this specific remote-GitHub-action policy;
5. wires a named **GitHub Actions pin review** step into normal CI;
6. makes release-security acceptance verify the package-script/CI wiring and execute the same repository-wide review;
7. adds focused Vitest coverage for pinned refs, mutable tags/branches, reusable workflows, and local/docker exclusions;
8. pins known CI and Product Eval action dependencies to immutable commits while retaining readable version comments.

## Initial immutable refs

```text
actions/checkout = fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09  # v5.1.0
actions/setup-node = a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
pnpm/action-setup = fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
```

## Boundary

A PASS means tracked workflow files contain no mutable remote GitHub Action refs at the time of the run and the continuous pin-review wiring remains present.

It does **not** prove:

- the pinned upstream action commits are vulnerability-free forever;
- live advisory/CVE freshness;
- external GitHub branch-protection configuration;
- production deployment correctness.

Updating a pinned action requires an explicit reviewed commit-SHA change.

## No runtime/provider mutation

F6-E04 makes no provider/model call, no hosted spend, no W18 rerun, and no VPS/Cloudflare mutation.

## Closure gate

Closure requires:

- exact-head CI PASS with the named **GitHub Actions pin review** step itself green;
- Product Eval PASS;
- all repository workflow refs accepted by the scanner;
- guarded merge;
- canonical docs closure sync.


## Closure evidence

```text
PR = #153
exact reviewed head = e1818eaac40a8166fd2b677aa815670c1ca0d7b6
CI #1041 = PASS
Product Eval #280 = PASS
MCP External HTTPS Acceptance #473 = PASS
merged main = 4742a9caf43e67b01345d69f0ea05cbbb2f081f0
```

The exact-head CI showed both **GitHub Actions pin review** and **Release security acceptance** PASS. The scanner initially found 10 mutable refs in Desktop Installer and MCP External Acceptance; those were fixed before the passing exact head. No provider/model call, hosted spend, or deployment mutation was made.

## Next scope

F6-E05 targets remaining mutable GitHub-hosted runner labels. GitHub currently supports fixed labels including `ubuntu-24.04` and `windows-2025`. The repo-side scope is to replace `ubuntu-latest` / `windows-latest` with fixed OS labels and continuously reject `*-latest` runner labels in tracked workflow YAML.
