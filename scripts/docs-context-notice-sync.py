from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


# Canonical handoff: make implementation-vs-operations progress explicit.
p = Path("docs/current-state-and-next-steps.md")
t = p.read_text()
anchor = "The final CI passed Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build.\n\n## 2. What is already in the baseline"
replacement = """The final CI passed Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, and Production Build.

### Progress snapshot

| Area | Progress at 2026-09-10 | Meaning |
|---|---:|---|
| Defined platform/production implementation roadmap | **12/12 batches = 100% CLOSED** | Planned repository implementation scope is finished and verified on `main`. |
| Production/self-host repository baseline | **READY** | Compose/Caddy/release/security baseline passed repository evidence. |
| Real VPS production deployment | **NEXT / not yet evidenced in this roadmap** | Deploy the closed baseline and collect environment-specific proof. |
| Cloudflare Free named Tunnel cutover | **NEXT / documented, not yet executed as production state** | Use Cloudflare as DNS/TLS/tunnel edge in front of the VPS. |
| Real hosted-provider validation | **NEXT / deterministic mechanism exists, real evidence pending** | Run operator-owned Anthropic/OpenRouter/OpenAI canaries/evals and record quality/latency/cost. |
| Durable external production telemetry | **NEXT** | Existing process metrics/traces need external retention for longitudinal evidence. |
| Product/R&D optimization evidence | **NEXT / evidence-driven** | Validate workflows, ECX savings, routing/model choices, and UX from real usage. |

Do not collapse these rows into one percentage. **100% refers only to the defined Batch 1–12 implementation roadmap**, not to the never-ending operational maturity of a live production system.

## 2. What is already in the baseline"""
t = once(t, anchor, replacement, "current-state progress snapshot")
p.write_text(t)

# Execution tracker: explicit 12/12 numerical progress.
p = Path("docs/EXECUTION-PROGRESS.md")
t = p.read_text()
t = once(
    t,
    "- platform/production roadmap status: **CLOSED — Batch 1–12 complete**",
    "- platform/production roadmap status: **CLOSED — 12/12 batches (100% of the defined roadmap) complete**",
    "tracker percentage",
)
p.write_text(t)

# Fase 2 planning doc: preserve plan but stop agents from treating it as active work.
p = Path("docs/fase2.md")
t = p.read_text()
anchor = "`docs/prd.md` §7 (Connect, Sync), §9 (arsitektur), §14 (keamanan), §15 (local-first\nhybrid), §16 (MCP), §23 (roadmap), `docs/research.md` §4 (MCP lengkap), ADR-09.\n\n## 0. Cara pakai dokumen ini"
replacement = """`docs/prd.md` §7 (Connect, Sync), §9 (arsitektur), §14 (keamanan), §15 (local-first
hybrid), §16 (MCP), §23 (roadmap), `docs/research.md` §4 (MCP lengkap), ADR-09.

> **HISTORICAL PLANNING NOTICE — 2026-09-10:** Fase 2 sudah diimplementasikan dan ditutup. Dokumen ini dipertahankan sebagai rencana pra-implementasi, bukan daftar pekerjaan aktif. Kontrak implementasi ada di `api-fase2.md`; current overall state ada di `current-state-and-next-steps.md` dan `EXECUTION-PROGRESS.md`. Jangan membangun ulang item di dokumen ini hanya karena status header historis masih menyebut draft.

## 0. Cara pakai dokumen ini"""
t = once(t, anchor, replacement, "fase2 historical notice")
p.write_text(t)

# API Fase 1: contract snapshot, not full current-state tracker.
p = Path("docs/api-fase1.md")
t = p.read_text()
anchor = "Pasangan: `docs/prd.md` §9 (arsitektur), §23 (roadmap Fase 1).\n\nSemua service pakai"
replacement = """Pasangan: `docs/prd.md` §9 (arsitektur), §23 (roadmap Fase 1).

> **CONTRACT-SNAPSHOT NOTICE — 2026-09-10:** dokumen ini menjelaskan kontrak Fase 1 dan tetap berguna untuk boundary tersebut, tetapi bukan source current status atau seluruh hardening yang datang setelahnya. Planned Batch 1–12 sudah CLOSED. Untuk current state/release/security/deployment, baca `current-state-and-next-steps.md`, `EXECUTION-PROGRESS.md`, dan operations/ADR terbaru sebelum mengubah kontrak lama.

Semua service pakai"""
t = once(t, anchor, replacement, "api fase1 notice")
p.write_text(t)

# Research: keep due diligence intact but clarify temporal role.
p = Path("docs/research.md")
t = p.read_text()
anchor = "Dokumen pasangan: `prd.md` (produk + arsitektur teknis), `design.md` (identitas visual).\n\n> **Aturan main dokumen ini:**"
replacement = """Dokumen pasangan: `prd.md` (produk + arsitektur teknis), `design.md` (identitas visual).

> **RESEARCH SNAPSHOT NOTICE — 2026-09-10:** riset ini tetap source alasan/due-diligence untuk keputusan arsitektur, tetapi bukan tracker implementasi. Setelah riset ini, planned platform/production Batch 1–12 telah CLOSED. Current state + next work ada di `current-state-and-next-steps.md` dan `EXECUTION-PROGRESS.md`. Jangan menganggap bagian yang berbicara dalam future tense sebagai pekerjaan yang masih otomatis terbuka.

> **Aturan main dokumen ini:**"""
t = once(t, anchor, replacement, "research snapshot notice")
p.write_text(t)
