from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def replace_exact_count(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} anchors, found {count}")
    return text.replace(old, new)


p = Path("docs/EXECUTION-PROGRESS.md")
t = p.read_text()
t = replace_exact_count(
    t,
    "- post-merge main MCP External HTTPS Acceptance `34485575560`: PASS",
    """- post-merge main MCP External HTTPS Acceptance `34485575560`: PASS
- closure PR #30 exact-head CI `34489719588`: full green
- closure PR #30 merge: `783a4ae8a2c90b3c696b3d619fb0c03581f675b2`
- final post-closure main CI `34490006960`: full green
- canonical post-closure handoff: `docs/current-state-and-next-steps.md`""",
    2,
    "progress final evidence",
)
t = replace_once(
    t,
    "- next implementation target: **none inside the closed Batch 1–12 roadmap**",
    """- next implementation target: **none inside the closed Batch 1–12 roadmap**
- next work is a **new explicit scope**, starting with real production deployment/provider validation rather than an implicit Batch 13
- recommended free public edge: **Cloudflare Free + Cloudflare Tunnel in front of the self-host VPS**; see `docs/cloudflare-free-deployment.md`""",
    "progress current state",
)
marker = "\n---\n\n# 9. Definition of Done per batch\n"
insert = """
---

## 8.1 Post-closure execution order

Batch 1–12 closure does not create Batch 13. Future work is scoped independently, in this order unless new evidence changes priority:

1. real VPS/self-host production deployment;
2. Cloudflare Free DNS/TLS edge + named Cloudflare Tunnel cutover;
3. real Anthropic/OpenRouter/OpenAI canary/evaluation with operator-owned credentials;
4. durable production observability retention and baseline metrics;
5. host/firewall/SSH/account/off-host-backup hardening;
6. product workflow validation;
7. RnD/ECX/optimizer validation from real telemetry;
8. UX/Control Center improvements;
9. ecosystem integrations through explicit APIs/contracts;
10. maintenance/security/dependency/DR drills and new features only from evidence.

Canonical handoff: `docs/current-state-and-next-steps.md`.
Cloudflare procedure: `docs/cloudflare-free-deployment.md`.

Cloudflare is transport/edge only. It does not become owner of Hub policy, Connect credentials/MCP configuration, Temporal, databases, Artifact storage, or Sandbox execution.
"""
if marker not in t:
    raise SystemExit("progress section marker missing")
t = t.replace(marker, insert + marker, 1)
p.write_text(t)

p = Path("docs/prd.md")
t = p.read_text()
notice = "> **CURRENT IMPLEMENTATION NOTE — 2026-09-10:** PRD ini tetap requirement/product-architecture source, bukan tracker implementasi. Planned platform/production Batch 1–12 sudah CLOSED dan production/self-host baseline sudah READY sesuai evidence. Current status + next scope ada di `current-state-and-next-steps.md` dan `EXECUTION-PROGRESS.md`. Tidak ada Batch 13 implisit; AutoClick tetap deferred by design dan Fase 6+ tetap evidence-driven/open-ended.\n\n"
if notice.strip() not in t:
    anchor = "**Riwayat:** DRAFT v0.1–v0.2"
    if anchor not in t:
        raise SystemExit("PRD history anchor missing")
    t = t.replace(anchor, notice + anchor, 1)
p.write_text(t)

p = Path("docs/blueprint.md")
t = p.read_text()
notice = "> **HISTORICAL EXECUTION BLUEPRINT NOTICE — 2026-09-10:** dokumen v1.0 ini dipertahankan untuk menjelaskan rencana/urutan awal. Tabel status fase di bawah adalah snapshot planning 2026-09-08 dan **bukan current implementation state**. Current state: Fase 0–4 CLOSED baseline, Fase 5 AutoClick DEFERRED BY DESIGN, planned platform/production Batch 1–12 CLOSED, 0 planned batches remaining, Fase 6+ OPEN-ENDED/evidence-driven. Mulai dari `current-state-and-next-steps.md` lalu `EXECUTION-PROGRESS.md` sebelum memakai blueprint ini.\n\n"
if notice.strip() not in t:
    anchor = "## 0. Cara pakai dokumen ini\n"
    if anchor not in t:
        raise SystemExit("blueprint anchor missing")
    t = t.replace(anchor, notice + anchor, 1)
p.write_text(t)

p = Path("docs/final-audit-2026-09-09.md")
t = p.read_text()
notice = "> **HISTORICAL SNAPSHOT:** audit ini merekam keadaan 2026-09-09 dan sengaja tidak direwrite untuk menyembunyikan blocker yang saat itu nyata. Blocker roadmap tersebut kemudian ditutup sampai Batch 12. Current canonical status ada di `current-state-and-next-steps.md`, `EXECUTION-PROGRESS.md`, dan `verification/batch12-closure-2026-09-10.md`.\n\n"
if notice.strip() not in t:
    anchor = "**Tanggal:** 2026-09-09"
    if anchor not in t:
        raise SystemExit("final audit anchor missing")
    t = t.replace(anchor, notice + anchor, 1)
p.write_text(t)

p = Path("docs/DECISIONS.md")
t = p.read_text().rstrip() + "\n"
rows = [
    "| 2026-09-10 | Planned platform/production roadmap Batch 1–12 resmi CLOSED; closure PR #30 merged sebagai `783a4ae8a2c90b3c696b3d619fb0c03581f675b2` dan final post-closure main CI `34490006960` PASS; future work adalah scope baru, bukan Batch 13 implisit | `current-state-and-next-steps.md`, `EXECUTION-PROGRESS.md`, `verification/batch12-closure-2026-09-10.md` |",
    "| 2026-09-10 | Recommended low-cost public edge untuk self-host production adalah Cloudflare Free + named Cloudflare Tunnel di depan VPS/Caddy; Cloudflare hanya transport/edge dan tidak mengambil ownership Hub/Connect/data/Temporal/Sandbox | `cloudflare-free-deployment.md`, ADR-33 |",
    "| 2026-09-10 | Prioritas post-closure: production deployment -> real provider validation -> durable observability -> host/account/backup hardening -> product validation -> RnD/ECX/optimizer validation -> UX/integration/maintenance berdasarkan evidence | `current-state-and-next-steps.md` |",
]
for row in rows:
    if row not in t:
        t += row + "\n"
p.write_text(t)
