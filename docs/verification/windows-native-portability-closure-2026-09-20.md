# Native Windows portability closure

Last updated: **2026-09-20**

Status: **CLOSED / PASS**

This maintenance closure records the native-Windows portability defects found after PE-08 and their repair. It does not reopen Product Evolution, create PE-09, create Batch 13, or change owner/security architecture.

## Baseline and defect isolation

The synchronized repository baseline was tested on native Windows 11 with the repository-pinned Node/pnpm toolchain.

The initial full run reduced to four failing tests from three cross-platform causes:

1. desktop release test compared a POSIX path suffix on Windows;
2. Sandbox Tier 0 spawned `pwd`, which has no native Windows executable;
3. production shell syntax validation resolved the Windows/WSL `bash.exe` launcher instead of the intended POSIX Bash.

The earlier large failure set was also traced to stale native-module ABI state plus CRLF checkout normalization rather than product logic.

## Repair

PR #182 implemented:

- repository line endings through `.gitattributes`: text LF, `.cmd`/`.bat` CRLF;
- platform-independent desktop bundle path assertion;
- Node-native Tier-0 `pwd`, `ls`, and `cat` filesystem behavior while keeping allowed Git execution on `spawn(..., { shell: false })`;
- workspace-containment checking for Tier-0 filesystem reads;
- explicit `ECORIONE_BASH` selection for production-script syntax validation on Windows;
- no installation of Unix `pwd`, no `shell: true`, and no weakening of Sandbox allowlist semantics.

## Windows-local verification

The reviewed branch passed:

```text
Prettier targeted check            PASS
Lint                               PASS
Typecheck                          PASS
Secret scan                        PASS
Production build                   PASS
Production activation with MSYS    5/5 PASS
Normal Vitest files                191 PASS + 1 skipped
Normal Vitest tests                990 PASS + 3 skipped
Failures                           0
```

The skipped cases remained environment-gated acceptance paths, not regressions.

## GitHub evidence

```text
PR                    #182
reviewed head         108781b5d53034462393f06d5e9cb36e9c5d5cf5
CI                    35457995357 / #1477 PASS
Product Eval          35457995360 / #716 PASS
merge main            3461951414f72c8f183527e3d28eec20dd383d45
```

CI #1477 passed naming, full-history secret scan, format, lint, typecheck, normal test, Phase 4 process acceptance, production-ops acceptance, secret scan, dependency/action/runner/toolchain/container/release-security reviews, and production build.

## Follow-up: clean-checkout reproducibility

The historical CI-only formatter mutation for three Product Evolution tests was removed in PR #183. The canonical Prettier output is committed instead, so CI validates the checkout it receives rather than silently rewriting source before `format:check`.

The implementation/evidence head `8b4bdc3793557dccf329a4aee19bec43ab8fb9bb` passed:

```text
CI                    35458711773 / #1479 PASS
Product Eval          35458711775 / #718 PASS
Format step           PASS without pre-format source mutation
Normal test step      PASS
Phase 4 acceptance    PASS
Production ops        PASS
Security/toolchain    PASS
Production build      PASS
```

This follow-up is repository hygiene and reproducibility hardening only; it does not change ECORIONE product scope.

Final closure evidence:

```text
PR                    #183
final closure head    451c3b45366ca42004d6c5af53f59c475e911e6f
CI                    35458911349 / #1482 PASS
Product Eval          35458911469 / #721 PASS
merge main            4980b3ceb149be58788467d2e11769de12977d5a
```

PR #183 is merged. Clean-checkout reproducibility is CLOSED / PASS.

## Boundary

Still deferred/outside this closure:

- production VPS/Cloudflare activation;
- AutoClick;
- paid hosted evidence without explicit authorization;
- L4 autonomy;
- persistent Brain graph database;
- unrelated product redesign.
