import { readFileSync, writeFileSync } from "node:fs";

function patch(path, from, to) {
  const text = readFileSync(path, "utf8");
  if (!text.includes(from)) throw new Error(`Anchor not found: ${path}`);
  writeFileSync(path, text.replace(from, to));
}
function append(path, value) {
  const text = readFileSync(path, "utf8");
  writeFileSync(path, `${text.trimEnd()}\n${value}\n`);
}

patch(
  "docs/adr/README.md",
  "Dua puluh empat keputusan yang membentuk ecorione",
  "Dua puluh lima keputusan yang membentuk ecorione",
);
patch(
  "docs/adr/README.md",
  "| [24](0024-plugin-extension-framework.md) | Hub memiliki plugin/extension control plane dengan immutable provenance dan no host execution |",
  "| [24](0024-plugin-extension-framework.md) | Hub memiliki plugin/extension control plane dengan immutable provenance dan no host execution |\n| [25](0025-unified-capability-permission-plane.md) | Hub adalah authority plane tunggal untuk workspace-scoped capability grants dan revocation |",
);

append(
  "docs/DECISIONS.md",
  '| 2026-09-09 | Unified capability/permission authority dimiliki Hub: declaration tidak memberi grant otomatis; grant/revoke workspace-scoped memakai `POLICY_ADMIN` + durable human approval, dan MCP/Extension/Sandbox/model/Flow memakai plane yang sama sebelum runtime-specific policy/egress | ADR-25, `docs/capability-permission-operations.md` |',
);

patch(
  "README.md",
  "- **Fase 6+ — ACTIVE:** credential vault, cumulative spend budget, Historical Ledger/ECX, multi-provider hardening, external MCP HTTPS acceptance, outbound MCP manager, dan Plugin/Extension Framework sudah masuk baseline candidate; unified capability/permission plane, multimodal/voice, data rebuild, node runtime, deployment/metrics/security tetap workstream berikutnya.",
  "- **Fase 6+ — ACTIVE:** credential vault, cumulative spend budget, Historical Ledger/ECX, multi-provider hardening, external MCP HTTPS acceptance, outbound MCP manager, Plugin/Extension Framework, dan Unified Capability/Permission Plane sudah masuk baseline candidate; multimodal/voice, data rebuild, node runtime, deployment/metrics/security tetap workstream berikutnya.",
);
patch(
  "README.md",
  "- Unified capability/permission grant + revocation plane belum selesai; extension manifest saat ini hanya mendeklarasikan kebutuhan dan tidak memberi grant otomatis.\n- Native OCR/STT/TTS/realtime voice belum menjadi capability runtime.",
  "- Unified capability/permission plane sudah diimplementasikan sebagai Hub-owned standing grant authority; declaration extension tetap bukan grant, outbound MCP membutuhkan grant operator eksplisit, dan closure final masih menunggu exact-head + post-merge evidence Batch 4.\n- Native OCR/STT/TTS/realtime voice belum menjadi capability runtime.",
);
patch(
  "README.md",
  "| [`docs/extension-operations.md`](docs/extension-operations.md) | Operasi extension manifest, lifecycle, provenance, rollback, dan security admission |",
  "| [`docs/extension-operations.md`](docs/extension-operations.md) | Operasi extension manifest, lifecycle, provenance, rollback, dan security admission |\n| [`docs/capability-permission-operations.md`](docs/capability-permission-operations.md) | Operasi authority grant/revoke, MCP/model/Sandbox/extension permission, dan failure semantics |",
);

const hardeningInsertion = `### 11. Unified Capability + Permission Plane\n\nADR-25 menjadikan Hub authority plane tunggal untuk standing capability grants lintas MCP, Extension, Sandbox, model/tool, Flow, dan future Node Registry:\n\n- grant di-scope oleh workspace + subject + capability + permission + scope + sensitivity ceiling;\n- unknown/missing grant fail closed;\n- declaration extension bukan grant dan tidak dapat menaikkan privilege sendiri;\n- grant/revoke memakai ActionClass \`POLICY_ADMIN\` dan durable human approval yang sudah dimiliki Hub;\n- active runtime tetap menjalankan generic policy, Vault, Spend Budget, Sandbox boundary, MCP local enablement, dan idempotency setelah standing authority lolos;\n- Chat hosted model dan Flow model memeriksa authority sebelum provider/egress;\n- Sandbox memeriksa authority sebelum generic policy/execution;\n- outbound MCP memeriksa tool authority dan, jika ada credentialRef, \`secret.access / credential.use\` sebelum generic policy/network dispatch;\n- extension install/update/rollback menyinkronkan declaration, update memangkas stale grants, remove membersihkan active grants tanpa menghapus revision provenance;\n- compatibility migration one-time eksplisit menjaga hosted/local model serta Sandbox tier0/tier1.5/tier1 pada \`ws_personal\`; grant tetap dapat di-revoke;\n- outbound MCP tidak dimigrasikan otomatis karena Hub tidak boleh mengintrospeksi registry/DB Connect.\n\nAuthority state tidak menyimpan raw secret. Canonical audit merekam authorize/deny/grant/revoke, sedangkan append-only authority events mempertahankan provenance control-plane.\n\nBatch 4 masih \`IMPLEMENTED / CLOSURE PENDING\` sampai exact-final-head CI + MCP External HTTPS, expected-head merge, dan post-merge \`main\` verification selesai.\n\n`;
patch(
  "docs/fase6-hardening.md",
  "## Gap hardening/platform yang masih terbuka\n",
  `${hardeningInsertion}## Gap hardening/platform yang masih terbuka\n`,
);
patch(
  "docs/fase6-hardening.md",
  "1. **Unified capability/permission plane** untuk grant/revoke workspace-scoped lintas MCP/Plugin/Sandbox/model/tool; extension declaration Batch 3 belum menjadi authority grant.\n2. **Native multimodal pipeline**: image/document first-class input, OCR, STT/TTS Indonesia+Inggris, lalu realtime voice.",
  "1. **Native multimodal pipeline**: image/document first-class input, OCR, STT/TTS Indonesia+Inggris, lalu realtime voice. Unified capability/permission plane sudah menjadi Batch 4 candidate dan menunggu closure evidence final.\n2. **Data refactor/rebuild + dataset governance**: authoritative-vs-derived separation, migration, reindex/rebuild, validation, lineage/versioning.",
);
// Remove duplicate old item 3 after renumbering first two.
patch(
  "docs/fase6-hardening.md",
  "3. **Data refactor/rebuild + dataset governance**: authoritative-vs-derived separation, migration, reindex/rebuild, validation, lineage/versioning.\n4. **Node Registry**",
  "3. **Node Registry**",
);
// Renumber remaining gap list after removing the completed item.
for (const [from, to] of [["5. **Space block", "4. **Space block"], ["6. **Data maintenance", "5. **Data maintenance"], ["7. **Managed/self-host", "6. **Managed/self-host"], ["8. **Provider canary", "7. **Provider canary"], ["9. **Full-history", "8. **Full-history"], ["10. **Next.js", "9. **Next.js"], ["11. **Cumulative", "10. **Cumulative"], ["12. **ECX", "11. **ECX"], ["13. **Chaos", "12. **Chaos"], ["14. **Final security", "13. **Final security"], ["15. **AutoClick", "14. **AutoClick"]]) {
  patch("docs/fase6-hardening.md", from, to);
}

patch(
  "docs/EXECUTION-PROGRESS.md",
  "Batch 3 implementation merged ke `main` sebagai:\n\n- `af2b3f12f5deeaf2fd50c045998416365f766b9d`\n\nPost-merge verification pada implementation SHA tersebut:\n\n- Naming: PASS\n- Format: PASS\n- Lint: PASS\n- Typecheck: PASS\n- Test: PASS\n- Phase 4 real-process acceptance: PASS\n- Secret Scan: PASS\n- Production Build: PASS\n- run `34368309860`, attempt 2: full green\n\n### Next execution target\n\n- Batch 3 status: **CLOSED**\n- next batch: **Batch 4 — Unified Capability + Permission Plane**\n- closure-doc branch: `agent/batch3-plugin-closure-20260909`",
  "Batch 3 closure docs merged ke `main` sebagai:\n\n- `df00c2bafad2449722293eef803fa8873921fd53`\n- final post-closure main CI `34369678467`: full green\n\n### Active execution\n\n- Batch 1 status: **CLOSED**\n- Batch 2 status: **CLOSED**\n- Batch 3 status: **CLOSED**\n- Batch 4 status: **IMPLEMENTED / CLOSURE PENDING**\n- active branch: `agent/unified-capability-permission-plane-20260909`\n- PR: #13 (draft sampai exact-head evidence lengkap)\n- next after Batch 4 closure: **Batch 5 — Native Multimodal Pipeline**",
);
patch(
  "docs/EXECUTION-PROGRESS.md",
  "Dari current state, **Batch 1, Batch 2, dan Batch 3 sudah CLOSED**. Tersisa **9 batch platform/production (Batch 4–12)**; next implementation target adalah **Batch 4 — Unified Capability + Permission Plane**.",
  "Dari current state, **Batch 1, Batch 2, dan Batch 3 sudah CLOSED**. Batch 4 sudah diimplementasikan dan sedang menunggu closure evidence; secara roadmap masih tersisa **9 batch (Batch 4–12)** sampai Batch 4 benar-benar CLOSED. Setelah closure, next implementation target adalah **Batch 5 — Native Multimodal Pipeline**.",
);
patch(
  "docs/EXECUTION-PROGRESS.md",
  "## Batch 4 — Unified Capability + Permission Plane\n\nStatus: **PLANNED**\n\nScope:\n\n- capability registry untuk model/MCP/plugin/node/tool/sandbox\n- permission scopes\n- read/write/network/filesystem distinctions\n- side-effect declaration\n- high-impact action approval\n- secret-access policy\n- sandbox policy\n- revoke capability\n- audit\n- fail-closed default\n\nTujuan: MCP, Plugin, Flow Node, Sandbox, dan AI memakai permission semantics yang konsisten.",
  `## Batch 4 — Unified Capability + Permission Plane\n\nStatus: **IMPLEMENTED / CLOSURE PENDING**\n\nImplemented candidate:\n\n- Hub-owned single authority plane; tidak ada permission database kedua di service lain;\n- workspace + subject + capability + permission + scope + sensitivity-ceiling standing grants;\n- fail-closed untuk unknown/undeclared/missing grants;\n- code-owned built-in capability definitions untuk MCP, Sandbox, hosted/local model, generic tool, secret access, dan future node;\n- \`POLICY_ADMIN\` selalu melewati durable human approval untuk grant/revoke;\n- immutable/idempotent authority mutation receipts + append-only authority events;\n- extension declaration bukan grant, permission terikat deterministik ke capability, stale grants dipangkas saat manifest update, remove membersihkan active grants;\n- Chat hosted model authority sebelum Context/provider egress;\n- Flow hosted/local model authority sebelum Connect;\n- Sandbox authority sebelum generic policy/execution;\n- outbound MCP authority sebelum policy/network dispatch dan credentialRef membutuhkan \`secret.access / credential.use\`;\n- one-time explicit compatibility grants untuk hosted/local model dan Sandbox tiers pada \`ws_personal\`; tetap revocable;\n- outbound MCP tidak auto-migrated karena Hub tidak mengintrospeksi Connect registry; operator wajib grant eksplisit;\n- raw credential tetap hanya di Connect Vault; authority state/audit tidak menyimpan secret.\n\nRegression evidence sebelum final docs head:\n\n- integration helper run \`34375813569\`: root Typecheck PASS + focused authority/extension/sandbox/orchestrate tests PASS;\n- regression hardening run \`34376301583\`: root Typecheck PASS + Chat/MCP/credential/extension/Sandbox focused tests PASS;\n- temporary helper workflows/scripts self-remove dan bukan bagian final candidate.\n\nADR: \`docs/adr/0025-unified-capability-permission-plane.md\`\nOperations: \`docs/capability-permission-operations.md\`\n\nClosure masih membutuhkan exact-final-head CI + MCP External HTTPS PASS, PR #13 expected-head merge, post-merge \`main\` verification, lalu tracker closure update.`
);

console.log("Batch 4 docs integrated.");
