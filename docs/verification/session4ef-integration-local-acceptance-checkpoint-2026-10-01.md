# Session 4E + 4F Integration Local-Acceptance Checkpoint — 2026-10-01

**Status:** READY FOR LOCAL ACCEPTANCE / NOT MERGED / NOT STAGING VERIFIED

## Exact branch boundary

```text
branch              = feat/session4ef-integration-20261001
base main           = c3ef2f186f465c2942b552974e47333c797cb4a1
4E code commit      = 41fe2b12fd0aab7233466f119d7c9324d00f0d17
4F contract commit  = d48f58c88f359c97780317ecbd82a8ad15097bfe
```

This checkpoint is an **integration-branch acceptance candidate**, not a claim that
`main`, staging, or production has advanced. The previously verified runtime baseline
remains `15dc2a131778c2fe1249dda34e3291f9a3c8beae` / `staging-15dc2a131778`.

## Package contents

The package reuses the previously started custom-provider branch instead of rewriting it,
then closes the missing product path and regressions found during local verification.

- `+ Tambah AI -> Lainnya` is enabled directly from Ai.
- The dialog collects Name, public HTTPS Base URL, exact Model, API key, and input/output
  USD-per-million-token pricing.
- Connect remains the credential owner; plaintext secrets stay out of normal Ai state,
  provider selectors, history, and returned completion evidence.
- Custom-provider activation uses a Connect-owned transient validation probe before Vault
  persistence and runtime activation.
- Custom egress is restricted to public HTTPS, rejects embedded credentials/fragments,
  checks DNS results, rejects loopback/private/non-public addresses, pins validated DNS
  candidates for the request, rejects redirects, and bounds timeout/response size.
- Custom execution keeps the validated exact model identity and operator-supplied pricing.
- Switching away from and back to the custom provider restores the validated model rather
  than silently using a different model.
- Existing first-class multi-credential priority/failover behavior is preserved.
- Local -> Hosted handoff reuses the existing Project-scoped Context boundary:
  hosted turns request only hosted-eligible memory/context and do not replay local-only
  conversation text into the hosted prompt.
- Session 4F locks the adjacent Provider/Source + Model selector UX, actionable loading/error
  states, hidden credential details, and custom-provider presentation.

## Local verification performed

Focused Session 4E/4F acceptance:

```text
29 tests PASS / 29
```

This focused set covers custom onboarding, public-HTTPS/SSRF boundaries, exact custom model,
pricing/reservation, provider/model UI polish, and the existing same-session Local -> Hosted
privacy behavior.

Repository gates:

```text
lint             PASS
typecheck        PASS
secret-scan      PASS
production build PASS
```
The production build has only pre-existing warnings around Next workspace-root inference,
the existing autoprefixer `end` warning, and Next ESLint-plugin detection.

Full Windows test run:

```text
test files: 276 PASS / 2 FAIL / 1 SKIP
tests:      1487 PASS / 4 FAIL / 4 SKIP
```

All four failures are confined to the existing Off-host DR evidence tests that require
Unix file mode `0600`. On Windows/NTFS the generated file mode is observed as `0666`,
so the mode assertion fails before later negative-path assertions can run. No Session 4E/4F
test failed in the final full run. The security test was **not weakened** to manufacture a
Windows PASS; Linux CI remains the correct authority for the Unix-mode requirement.

## Claims deliberately not made

This branch does **not** claim:

- a real user API key or external custom-provider credential has been validated;
- every third-party OpenAI-compatible implementation is compatible;
- exact-head GitHub CI has passed this candidate yet;
- staging has deployed this candidate;
- Session 4E/4F is merged/closed on `main`;
- production has changed.

## Local acceptance checklist

Use the already checked-out branch `feat/session4ef-integration-20261001`.

1. Confirm `git status -sb`; the user-owned untracked `.playwright-cli/` directory may
   remain and must not be deleted merely for this acceptance.
2. Start the normal local ECORIONE stack.
3. Confirm Local chat still works inside the intended Project.
4. Connect a normal hosted provider; if useful, verify multiple keys and priority/failover.
5. Open `+ Tambah AI -> Lainnya / Custom OpenAI-compatible`.
6. With a real provider under the user's control, enter Name, public HTTPS Base URL, exact
   model, API key, and pricing; confirm invalid/private endpoints fail clearly.
7. Confirm successful custom onboarding produces one logical provider choice, not one row
   per API key.
8. In one conversation, switch Local -> hosted -> custom -> Local and confirm the next
   message follows the selected route/model without silently changing models.
9. Confirm local-only prior text is not surfaced to the hosted provider through the visible
   conversation/context behavior.
10. Check Settings AI Connections for enable/disable, primary/priority, and removal behavior.
11. Report any UX/runtime defect while staying on this integration branch.

## Gate after operator acceptance

Only after local acceptance:

1. preserve the exact accepted branch SHA;
2. push/finalize the branch if necessary;
3. open one integration PR;
4. require exact-head CI/Product Eval/relevant acceptance;
5. fix only on this branch until green;
6. merge the reviewed exact head;
7. verify merged-main CI;
8. deploy/verify staging;
9. then synchronize canonical closure docs and mark Session 4E/4F closed.

Until those steps happen, `main` and the prior staging runtime baseline remain authoritative.
