from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"{label} target not found")
    path.write_text(text.replace(old, new, 1))


path = Path("docs/current-state-and-next-steps.md")

replace_once(
    path,
    "local observability baseline CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS; UX/product validation is the active next checkpoint; compute-host/VPS + Cloudflare remains DEFERRED BY OPERATOR.",
    "local observability baseline CLOSED / PASS WITH BOUNDED LOCAL LIMITATIONS; UX/product validation is IN PROGRESS with code-side static hardening complete and the rendered local walkthrough pending; compute-host/VPS + Cloudflare remains DEFERRED BY OPERATOR.",
    "verdict",
)

replace_once(
    path,
    "| UX/product validation | **ACTIVE NEXT CHECKPOINT** | Exercise real user journeys and identify functional/usability defects on the closed local runtime baseline. |",
    "| UX/product validation | **IN PROGRESS — STATIC HARDENING COMPLETE / RUNTIME WALKTHROUGH PENDING** | Code-side hardening is merged through `63646960da0f4dce946208470eed1c7d6f3068e4`; the real local browser inventory/walkthrough remains required. |",
    "status table",
)

replace_once(
    path,
    "- local observability implementation PR #52 → `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`.",
    "- local observability implementation PR #52 → `bbd9c1aeed0c0aaffc39b6f912c35e96b73702b6`;\n- UX/frontend hardening continued through PR #56, #58, #59 and #60; the final code-side baseline is `63646960da0f4dce946208470eed1c7d6f3068e4` with exact-head and post-merge CI PASS for the final hardening chain.",
    "progression",
)

replace_once(
    path,
    "4. **UX/product validation — ACTIVE NEXT CHECKPOINT**",
    "4. **UX/product validation — IN PROGRESS; STATIC HARDENING COMPLETE / RUNTIME WALKTHROUGH PENDING**",
    "execution order",
)

replace_once(
    path,
    "## 10. Next checkpoint — UX/product validation\n\nThe next scope should validate real user journeys on the already-closed local technical baseline before adding new infrastructure or production deployment work.\n\nMinimum intended work:",
    "## 10. Active checkpoint — UX/product validation\n\nCode-side/static frontend hardening is complete through merged `main` revision `63646960da0f4dce946208470eed1c7d6f3068e4`. Canonical static evidence is `docs/verification/frontend-static-hardening-2026-09-12.md`; the runtime protocol is `docs/ux-product-validation.md`.\n\nThe remaining scope crosses the real browser/runtime boundary. It must validate real user journeys on the already-closed local technical baseline before adding new infrastructure or production deployment work.\n\nMinimum remaining work:",
    "active ux section",
)

replace_once(
    path,
    "1. `docs/current-state-and-next-steps.md`\n2. `AGENTS.md`\n3. `docs/verification/local-observability-closure-2026-09-12.md`",
    "1. `docs/current-state-and-next-steps.md`\n2. `AGENTS.md`\n3. `docs/ux-product-validation.md`\n4. `docs/verification/frontend-static-hardening-2026-09-12.md`\n5. `docs/verification/local-observability-closure-2026-09-12.md`",
    "reading order prefix",
)

# Renumber the remainder of the existing reading list to avoid duplicate numbering.
text = path.read_text()
for old, new in [
    ("\n4. `docs/local-observability-evidence.md`", "\n6. `docs/local-observability-evidence.md`"),
    ("\n5. `docs/verification/local-backup-restore-closure-2026-09-11.md`", "\n7. `docs/verification/local-backup-restore-closure-2026-09-11.md`"),
    ("\n6. `docs/local-backup-restore-evidence.md`", "\n8. `docs/local-backup-restore-evidence.md`"),
    ("\n7. `docs/verification/local-persistence-restart-closure-2026-09-11.md`", "\n9. `docs/verification/local-persistence-restart-closure-2026-09-11.md`"),
    ("\n8. `docs/local-persistence-restart-evidence.md`", "\n10. `docs/local-persistence-restart-evidence.md`"),
    ("\n9. `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`", "\n11. `docs/verification/local-persistence-restart-first-drill-2026-09-11.md`"),
    ("\n10. `docs/verification/comparative-closure-grade-final-2026-09-11.md`", "\n12. `docs/verification/comparative-closure-grade-final-2026-09-11.md`"),
    ("\n11. `docs/comparative-ecx-evidence.md`", "\n13. `docs/comparative-ecx-evidence.md`"),
    ("\n12. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`", "\n14. `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`"),
    ("\n13. `docs/verification/local-production-rehearsal-2026-09-10.md`", "\n15. `docs/verification/local-production-rehearsal-2026-09-10.md`"),
    ("\n14. `docs/EXECUTION-PROGRESS.md`", "\n16. `docs/EXECUTION-PROGRESS.md`"),
    ("\n15. relevant operations/ADR docs", "\n17. relevant operations/ADR docs"),
    ("\n16. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` for rationale/history", "\n18. `docs/prd.md`, `docs/research.md`, `docs/blueprint.md` for rationale/history"),
]:
    if old not in text:
        raise SystemExit(f"reading-list target not found: {old}")
    text = text.replace(old, new, 1)
path.write_text(text)

replace_once(
    path,
    "- current handoff: `docs/current-state-and-next-steps.md`\n- observability closure:",
    "- current handoff: `docs/current-state-and-next-steps.md`\n- UX runtime protocol: `docs/ux-product-validation.md`\n- UX static hardening evidence: `docs/verification/frontend-static-hardening-2026-09-12.md`\n- observability closure:",
    "canonical refs",
)
