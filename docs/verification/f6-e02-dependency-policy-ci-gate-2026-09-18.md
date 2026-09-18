# F6-E02 — Continuous Dependency-Policy CI Gate

Date: **2026-09-18**

Status: **CLOSED / REPO-SIDE PASS**

## Scope

F6-E02 closes a concrete continuous-gating gap discovered after F6-E01 closure:

- `package.json` already exposed `pnpm dependency:review`;
- `scripts/dependency-security-review.mjs` already enforced deterministic dependency/source policy;
- normal `.github/workflows/ci.yml` did **not** execute that policy.

The implementation now:

1. adds a named **Dependency policy review** step to the normal CI `verify` job;
2. executes `pnpm run dependency:review` on every normal CI run;
3. extends `scripts/release-security-acceptance.mjs` so release acceptance fails if:
   - the `dependency:review` package script disappears or changes away from the governed script; or
   - normal CI no longer contains the named dependency-policy step and exact command.

## Deterministic policy boundary

The existing dependency review checks:

- package manifests for wildcard/latest and unsupported direct git/http/source specifications;
- Docker image explicit-tag policy and `:latest` rejection;
- presence of a valid `pnpm-lock.yaml` lockfile marker.

This scope does **not** perform live registry vulnerability lookup and does **not** claim CVE/advisory freshness.

## No provider/runtime mutation

F6-E02 is repository/CI governance only:

- no local model call;
- no hosted provider call;
- no W18 rerun;
- no provider spend;
- no VPS/Cloudflare mutation.

## Closure gate

Closure requires exact-head CI PASS with the new **Dependency policy review** step itself passing, plus Product Eval if triggered by the repository workflow set, guarded merge, and post-merge canonical documentation sync.

Claim after closure must remain:

> deterministic dependency/source policy is continuously enforced by normal repository CI and its presence is protected by release acceptance.

Do not expand that into a live vulnerability/CVE freshness claim.


## Closure evidence

```text
PR = #149
exact reviewed head = 1cd4795b1a65baa1a2320713a3c8ffe520cfc98f
CI #1029 = PASS
Product Eval #268 = PASS
Dependency policy review step = PASS
merged main = 20aedfe94ee9f3db321dd3a66625bedd56a334a1
```

No provider/model call, hosted spend, or deployment mutation was made.

## Final verdict

**F6-E02 = CLOSED / REPO-SIDE PASS** at the deterministic continuous dependency-policy boundary.

The closure claim remains limited to repository dependency/source policy, Docker image tag policy, lockfile presence, and CI/release-acceptance wiring. It is not a live registry vulnerability or CVE freshness claim.
