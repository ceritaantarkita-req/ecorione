from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"anchor missing in {path}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1))

# README
readme = Path("README.md")
replace_once(
    readme,
    "Discovery tidak otomatis mengaktifkan tool. Ambiguous side effect menjadi `MCP_OUTCOME_UNCERTAIN` dan tidak boleh di-retry otomatis; retry yang sudah diketahui ambiguous ditolak sebelum reconnect. Stdio bukan jalur arbitrary plugin execution: executable harus diizinkan exact oleh operator, dan Plugin/Extension Framework tetap workstream terpisah. Lihat [`docs/outbound-mcp-operations.md`](docs/outbound-mcp-operations.md).\n\n## Arsitektur saat ini",
    "Discovery tidak otomatis mengaktifkan tool. Ambiguous side effect menjadi `MCP_OUTCOME_UNCERTAIN` dan tidak boleh di-retry otomatis; retry yang sudah diketahui ambiguous ditolak sebelum reconnect. Stdio bukan jalur arbitrary plugin execution: executable harus diizinkan exact oleh operator. Lihat [`docs/outbound-mcp-operations.md`](docs/outbound-mcp-operations.md).\n\n## Plugin / Extension Framework\n\nHub memiliki control plane extension dengan manifest versioned, immutable source pin, SHA-256 bundle identity yang dibind ke Artifact CAS, workspace-scoped installation, append-only revision provenance, idempotent lifecycle receipt, rollback, dan health state. Runtime baseline hanya `none | mcp | sandbox`; tidak ada host-process execution. MCP extension tetap memakai Connect outbound MCP manager dan executable extension hanya boleh lewat Sandbox.\n\nSecurity admission membuktikan identity/integrity/declaration consistency dan dijalankan sebelum policy/audit mutation. Itu **bukan** klaim vulnerability-free. Capability/permission/secret declaration Batch 3 juga belum menjadi grant otomatis; unified grant/revocation authority diselesaikan pada Batch 4. Lihat [`docs/extension-operations.md`](docs/extension-operations.md) dan ADR-24.\n\n## Arsitektur saat ini",
)
replace_once(
    readme,
    "- **Fase 6+ — ACTIVE:** credential vault, cumulative spend budget, Historical Ledger/ECX, multi-provider hardening, external MCP HTTPS acceptance, dan outbound MCP manager sudah masuk baseline; plugin framework, multimodal/voice, data rebuild, node runtime, deployment/metrics/security tetap workstream berikutnya.",
    "- **Fase 6+ — ACTIVE:** credential vault, cumulative spend budget, Historical Ledger/ECX, multi-provider hardening, external MCP HTTPS acceptance, outbound MCP manager, dan Plugin/Extension Framework sudah masuk baseline candidate; unified capability/permission plane, multimodal/voice, data rebuild, node runtime, deployment/metrics/security tetap workstream berikutnya.",
)
replace_once(
    readme,
    "- Plugin/extension registry + security gate belum ada; outbound MCP manager sudah ada, tetapi arbitrary extension/repository execution tetap tidak didukung.",
    "- Unified capability/permission grant + revocation plane belum selesai; extension manifest saat ini hanya mendeklarasikan kebutuhan dan tidak memberi grant otomatis.",
)
replace_once(
    readme,
    "| [`docs/outbound-mcp-operations.md`](docs/outbound-mcp-operations.md) | Operasi outbound MCP registry, credential, tool, dan failure handling |\n| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Log keputusan aktual |",
    "| [`docs/outbound-mcp-operations.md`](docs/outbound-mcp-operations.md) | Operasi outbound MCP registry, credential, tool, dan failure handling |\n| [`docs/extension-operations.md`](docs/extension-operations.md) | Operasi extension manifest, lifecycle, provenance, rollback, dan security admission |\n| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Log keputusan aktual |",
)

# Decisions append.
decisions = Path("docs/DECISIONS.md")
text = decisions.read_text()
row = "| 2026-09-09 | Plugin/Extension Framework dimiliki Hub sebagai control plane: manifest/source dipin immutable, bundle dibind ke Artifact CAS, revision append-only, mutation idempotent, runtime hanya none/MCP/Sandbox, dan tidak ada arbitrary host execution; declaration permission belum menjadi grant otomatis | ADR-24, `docs/extension-operations.md` |\n"
if row not in text:
    if not text.endswith("\n"):
        text += "\n"
    decisions.write_text(text + row)

# Fase 6 hardening.
fase6 = Path("docs/fase6-hardening.md")
replace_once(
    fase6,
    "Code candidate sebelum docs lulus full CI `34357212048` dan inbound public HTTPS regression acceptance `34357212042`. Ini adalah evidence candidate, bukan closure final; exact docs head, merge, dan post-merge main verification tetap wajib. Arbitrary plugin/repository execution tetap tidak termasuk baseline ini.\n\n## Gap hardening/platform yang masih terbuka",
    "Code candidate sebelum docs lulus full CI `34357212048` dan inbound public HTTPS regression acceptance `34357212042`. Batch 2 kemudian ditutup pada final head `5609d8cae9fe9bb83a751da5616822b8dec1c4a2`: CI `34359796175` PASS, public HTTPS `34359796083` PASS, PR #9 merged sebagai `97646e102ee90a39aa25a7b79b8cbf86673aa81f`, dan post-merge main CI `34360113741` full green.\n\n### 10. Plugin / Extension Framework\n\nADR-24 menambahkan Hub-owned extension control plane tanpa membuat arbitrary code execution path:\n\n- strict manifest `ecorione.extension/v1` dengan immutable GitHub SHA / HTTPS release / Artifact source;\n- bundle SHA-256 harus identik dengan Artifact CAS identity;\n- runtime hanya `none`, `mcp`, atau `sandbox`; tidak ada host runtime;\n- MCP execution tetap melalui Connect outbound MCP manager; executable extension hanya melalui Sandbox;\n- capability, permission, dan secret requirement dideklarasikan tetapi belum menjadi grant otomatis;\n- security admission berjalan sebelum policy/audit mutation dan blocked manifest tidak membuat registry state;\n- durable workspace-scoped installation projection + append-only revision history;\n- install/update/rollback/remove/health memakai transactional idempotent receipts;\n- rollback membuat revision baru dan mempertahankan provenance target;\n- remove tidak menghapus revision provenance.\n\nIntegrity gate ini tidak diklaim sebagai vulnerability scanner. Unified grant/revocation dan cross-runtime permission authority tetap Batch 4.\n\n## Gap hardening/platform yang masih terbuka",
)
replace_once(
    fase6,
    "1. **Plugin/extension framework + security gate** termasuk GitHub-origin extension, manifest, pin revision, sandbox, permission, rollback.\n2. **Native multimodal pipeline**: image/document first-class input, OCR, STT/TTS Indonesia+Inggris, lalu realtime voice.\n3. **Data refactor/rebuild + dataset governance**: authoritative-vs-derived separation, migration, reindex/rebuild, validation, lineage/versioning.\n4. **Unified capability/permission registry + Node Registry** sebagai dasar visual Flow Canvas, core node pack, custom node SDK, dan reusable subflow.",
    "1. **Unified capability/permission plane** untuk grant/revoke workspace-scoped lintas MCP/Plugin/Sandbox/model/tool; extension declaration Batch 3 belum menjadi authority grant.\n2. **Native multimodal pipeline**: image/document first-class input, OCR, STT/TTS Indonesia+Inggris, lalu realtime voice.\n3. **Data refactor/rebuild + dataset governance**: authoritative-vs-derived separation, migration, reindex/rebuild, validation, lineage/versioning.\n4. **Node Registry** di atas capability/permission plane sebagai dasar visual Flow Canvas, core node pack, custom node SDK, dan reusable subflow.",
)

# Canonical execution tracker.
progress = Path("docs/EXECUTION-PROGRESS.md")
replace_once(
    progress,
    "Baseline `main` tempat Batch 2 branch dibuat:\n\n- `69cffc81694bff30260c1c9aaeae2cf667d5534f`",
    "Baseline `main` tempat Batch 3 branch dibuat:\n\n- `97646e102ee90a39aa25a7b79b8cbf86673aa81f`",
)
replace_once(
    progress,
    "Batch 1 tracker closure sudah merged pada baseline ini.",
    "Batch 2 sudah merged dan post-merge main CI `34360113741` full green pada baseline ini.",
)
old_active = """- branch: `agent/outbound-mcp-manager-20260909`
- PR: #9 — `feat: add outbound MCP client and manager`
- Batch 2 status: **IMPLEMENTED / CLOSURE PENDING**
- clean code candidate sebelum docs: `1cf736611d2b2a2778884d971b1afa92057f37b3`
- code candidate CI: `34357212048` — full green
- inbound public HTTPS regression acceptance: `34357212042` — PASS
- exact docs/final head, merge, dan post-merge `main` verification: pending"""
new_active = """- branch: `agent/plugin-extension-framework-20260909`
- PR: #10 — `feat: add plugin and extension framework`
- Batch 3 status: **IMPLEMENTED / CLOSURE PENDING**
- base main: `97646e102ee90a39aa25a7b79b8cbf86673aa81f`
- extension focused Typecheck + regression: PASS
- exact final CI, merge, dan post-merge `main` verification: pending"""
replace_once(progress, old_active, new_active)
replace_once(
    progress,
    "Dari current state, **Batch 1 sudah CLOSED** dan **Batch 2 sudah implemented / closure pending**. Setelah Batch 2 ditutup, tersisa **10 batch platform/production (Batch 3–12)**.",
    "Dari current state, **Batch 1 dan Batch 2 sudah CLOSED**. **Batch 3 implemented / closure pending**; setelah Batch 3 ditutup, tersisa **9 batch platform/production (Batch 4–12)**.",
)
replace_once(progress, "## Batch 2 — Outbound MCP Client + MCP Manager\n\nStatus: **IMPLEMENTED / CLOSURE PENDING**", "## Batch 2 — Outbound MCP Client + MCP Manager\n\nStatus: **CLOSED**")
replace_once(
    progress,
    "Closure masih pending karena final docs head harus lolos exact-head gate, PR #9 harus merged dengan expected-head lock, dan post-merge `main` harus diverifikasi hijau. Setelah itu tracker boleh mengubah Batch 2 menjadi `CLOSED`; next implementation batch adalah Batch 3.",
    "Closure evidence:\n\n- final PR head: `5609d8cae9fe9bb83a751da5616822b8dec1c4a2`;\n- CI `34359796175` — full green;\n- MCP External HTTPS Acceptance `34359796083` — PASS;\n- PR #9 merge SHA: `97646e102ee90a39aa25a7b79b8cbf86673aa81f`;\n- post-merge main CI `34360113741` — full green.\n\nBatch 2 resmi `CLOSED`; next implementation batch adalah Batch 3.",
)
old_batch3 = """## Batch 3 — Plugin / Extension Framework

Status: **PLANNED**

Scope:

- Plugin Registry
- manifest/version/source metadata
- pinned Git revision/release
- capability declaration
- permission requirements
- secret requirements
- install/update/remove
- rollback
- integrity/provenance
- extension health
- workspace visibility

Security rule:

> Arbitrary GitHub repository **tidak boleh** langsung dieksekusi di host process. Source harus melalui pinned revision, validation/security gate, dan Sandbox bila membawa executable code."""
new_batch3 = """## Batch 3 — Plugin / Extension Framework

Status: **IMPLEMENTED / CLOSURE PENDING**

Implemented baseline:

- strict versioned manifest `ecorione.extension/v1`;
- immutable GitHub commit SHA / HTTPS release / Artifact source identity;
- SHA-256 bundle identity bound to Artifact CAS;
- execution kinds only `none | mcp | sandbox`; no host execution;
- MCP execution remains behind Connect outbound MCP manager;
- executable extension remains behind Sandbox;
- declared capabilities, permissions/ActionClass, and secret requirements;
- fail-closed security admission before policy/audit mutation;
- durable workspace-scoped installation registry;
- append-only extension revisions;
- transactional idempotent install/update/rollback/remove/health receipts;
- same idempotency key + different canonical fingerprint fails conflict;
- rollback creates a new revision and preserves target provenance;
- remove preserves revision history;
- workspace-isolated list/get/revision visibility;
- HTTP lifecycle regression covers validation, idempotency, isolation, update/rollback, health, remove, and blocked admission.

Security rule:

> Arbitrary GitHub repository **tidak boleh** langsung dieksekusi di host process. Digest/provenance admission proves identity/integrity, not vulnerability absence. Capability/permission declaration is not an authority grant until Batch 4.

ADR: `docs/adr/0024-plugin-extension-framework.md`\nOperations: `docs/extension-operations.md`\nClosure pending: exact final CI + public MCP regression, PR #10 expected-head merge, dan post-merge main verification."""
replace_once(progress, old_batch3, new_batch3)

print("extension docs patched")
