from pathlib import Path

path = Path("docs/EXECUTION-PROGRESS.md")
text = path.read_text()

replacements = [
    (
        """Batch 11 implementation is merged and post-merge verified on `main`:

- implementation PR #27 merge: `2e52af3bb8652154bd70846120767b67297bc1fd`
- exact final PR head: `8056db267dd30203e9208a7ccc3fcfb07390bf2c`
- exact-head CI `34448405724`: full green, including Production Operations acceptance
- exact-head MCP External HTTPS Acceptance `34448405823`: PASS
- post-merge main CI `34448620805`: full green""",
        """Batch 12 implementation is merged and post-merge verified on `main`:

- implementation PR #29 merge: `ad67b68290a41e69e18dfa49caefed0090bd9635`
- exact final implementation head: `c59d5c2f39b99615afcc9dbf17432f9cbc69bce9`
- exact-head CI `34485292260`: full green, including Production Build
- exact-head MCP External HTTPS Acceptance `34485292292`: PASS
- post-merge main CI `34485575168`, attempt 2: full green on the unchanged merge SHA; attempt 1 hit one transient 60-second Temporal test timeout before the rerun passed
- post-merge main MCP External HTTPS Acceptance `34485575560`: PASS""",
    ),
    (
        """- Batch 10 status: **CLOSED**
- Batch 11 status: **CLOSED**
- next implementation target: **Batch 12 — Final Security / Release Closure**""",
        """- Batch 10 status: **CLOSED**
- Batch 11 status: **CLOSED**
- Batch 12 status: **CLOSED**
- platform/production roadmap status: **CLOSED — Batch 1–12 complete**
- next implementation target: **none inside the closed Batch 1–12 roadmap**""",
    ),
    (
        "Dari current state, **Batch 1–11 sudah CLOSED**. Tersisa **1 batch platform/production (Batch 12)**; next implementation target adalah **Batch 12 — Final Security / Release Closure**.",
        "Dari current state, **Batch 1–12 sudah CLOSED**. Tidak ada batch platform/production yang tersisa di roadmap ini. Pekerjaan berikutnya harus masuk sebagai scope baru, maintenance/operations, atau R&D evidence-driven; bukan Batch 13 otomatis.",
    ),
    (
        """## Batch 12 — Final Security / Release Closure

Status: **IN PROGRESS**""",
        """## Batch 12 — Final Security / Release Closure

Status: **CLOSED**""",
    ),
    (
        """- final exact-head CI closure
- post-merge/release verification

Closure label yang boleh digunakan setelah batch ini memenuhi evidence:""",
        """- final exact-head CI closure
- post-merge/release verification

Implemented baseline:

- shared internal HTTP boundary hardening: timing-safe bearer comparison, bounded request IDs/body parsing, security headers, no-store behavior, and bounded process-local rate limiting;
- public URL/SSRF validation rejects unsafe protocols, embedded credentials, private/local literal hosts, and unsafe resolved address ranges;
- working-tree and full Git-history secret scans plus deterministic dependency policy review and production registry audit gate;
- focused release/security acceptance retains AuthN/AuthZ, Sandbox escape, MCP/plugin permission, backup/recovery, failure/chaos, worker audit, and runtime-settings coverage;
- Ai `/settings` operator Control Center with Connect-owned provider/model, credential-reference, and MCP configuration; credential plaintext is not returned to Ai;
- developer SDK/docs plus conservative self-host install, upgrade, migration, rollback, and release-operations procedures;
- Next.js ESLint integration and production-build cleanup are release-blocking;
- external MCP public HTTPS acceptance is provider-resilient: pinned Cloudflare remains the primary option when available and an independent Pinggy SSH/HTTPS path prevents one Quick Tunnel DNS-provisioning incident from invalidating the ECORIONE transport proof;
- temporary Batch 12 integration/format/navigation/MCP diagnostic helpers are absent from the merged implementation tree.

Bugs/fixes discovered during closure:

- CSS Modules global selector in `/settings` was scoped to the local page root;
- `/space` root navigation was moved from raw `<a>` to Next `Link` and the related production-build lint issue was removed;
- Cloudflare Quick Tunnel produced repeated fresh-host NXDOMAIN/HTTP 530 despite registered edge connectivity, so the acceptance harness was changed to a multi-provider real-public-HTTPS design rather than weakening or skipping the gate;
- the first post-merge CI attempt hit a single 60-second Temporal test timeout while 530 other tests passed; rerunning the same job on the unchanged merge SHA passed the full suite and all subsequent CI stages.

Closure evidence:

- implementation branch: `agent/batch12-final-security-release-20260910`;
- implementation PR: #29;
- pre-PR integration/security gate `34476691984`: PASS;
- full provider-resilient public HTTPS MCP proof `34485069385`: PASS;
- final exact implementation head: `c59d5c2f39b99615afcc9dbf17432f9cbc69bce9`;
- exact-head CI `34485292260`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34485292292`: PASS;
- PR #29 merged with expected-head lock as `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- post-merge main CI `34485575168`, attempt 2: full green on `ad67b68290a41e69e18dfa49caefed0090bd9635`;
- post-merge main MCP External HTTPS Acceptance `34485575560`: PASS;
- roadmap result: Batch 1–12 production/platform plan is complete; Fase 6+ remains open-ended/evidence-driven and AutoClick remains deferred by design.

Verification: `docs/verification/batch12-closure-2026-09-10.md`

Batch 12 resmi **CLOSED**. Tidak ada Batch 13 implisit; future work memerlukan scope baru yang eksplisit.

Closure label yang boleh digunakan setelah batch ini memenuhi evidence:""",
    ),
    (
        """- **Batch 10: CLOSED**
- **Batch 11: CLOSED**
- **1 platform/production batch remaining (Batch 12)**
- next: **Batch 12 — Final Security / Release Closure**""",
        """- **Batch 10: CLOSED**
- **Batch 11: CLOSED**
- **Batch 12: CLOSED**
- **0 planned platform/production batches remaining in this roadmap**
- next: **new explicitly scoped maintenance, operations, product-validation, or R&D work only**""",
    ),
    (
        "**Immediate next:** mulai **Batch 7 — Data Refactor / Rebuild Engine** dari baseline `main` setelah Batch 6 CLOSED. Historical Ledger dan Context L0 tetap immutable; maintenance wajib melalui owner-service contract/API tanpa cross-service database access.",
        "**Immediate next:** tidak ada batch platform/production roadmap yang tersisa. Future work harus dibuka sebagai scope baru yang eksplisit dari `main` yang sudah terverifikasi, dengan Fase 6+ tetap open-ended/evidence-driven. AutoClick tetap deferred sampai ada use case non-API nyata yang lolos review arsitektur.",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one tracker target, found {count}: {old[:100]!r}")
    text = text.replace(old, new, 1)

path.write_text(text)
