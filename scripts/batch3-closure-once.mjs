import { readFileSync, writeFileSync } from "node:fs";

function replaceExactlyOnce(text, oldValue, newValue, label) {
  const first = text.indexOf(oldValue);
  if (first < 0 || text.indexOf(oldValue, first + oldValue.length) >= 0) {
    throw new Error(`${label} anchor mismatch`);
  }
  return text.replace(oldValue, newValue);
}

const trackerPath = "docs/EXECUTION-PROGRESS.md";
let tracker = readFileSync(trackerPath, "utf8");

tracker = replaceExactlyOnce(
  tracker,
  `Baseline \`main\` tempat Batch 3 branch dibuat:\n\n- \`97646e102ee90a39aa25a7b79b8cbf86673aa81f\`\n\nBaseline condition sebelum Batch 2:\n\n- Format: PASS\n- Lint: PASS\n- Typecheck: PASS\n- Test: PASS\n- Secret Scan: PASS\n- Production Build: PASS\n- Naming: PASS\n\nBatch 2 sudah merged dan post-merge main CI \`34360113741\` full green pada baseline ini.\n\n### Active branch\n\n- branch: \`agent/plugin-extension-framework-20260909\`\n- PR: #10 — \`feat: add plugin and extension framework\`\n- Batch 3 status: **IMPLEMENTED / CLOSURE PENDING**\n- base main: \`97646e102ee90a39aa25a7b79b8cbf86673aa81f\`\n- extension focused Typecheck + regression: PASS\n- exact final CI, merge, dan post-merge \`main\` verification: pending\n`,
  `Batch 3 implementation merged ke \`main\` sebagai:\n\n- \`af2b3f12f5deeaf2fd50c045998416365f766b9d\`\n\nPost-merge verification pada implementation SHA tersebut:\n\n- Naming: PASS\n- Format: PASS\n- Lint: PASS\n- Typecheck: PASS\n- Test: PASS\n- Phase 4 real-process acceptance: PASS\n- Secret Scan: PASS\n- Production Build: PASS\n- run \`34368309860\`, attempt 2: full green\n\n### Next execution target\n\n- Batch 3 status: **CLOSED**\n- next batch: **Batch 4 — Unified Capability + Permission Plane**\n- closure-doc branch: \`agent/batch3-plugin-closure-20260909\`\n`,
  "current state",
);

tracker = replaceExactlyOnce(
  tracker,
  "Dari current state, **Batch 1 dan Batch 2 sudah CLOSED**. **Batch 3 implemented / closure pending**; setelah Batch 3 ditutup, tersisa **9 batch platform/production (Batch 4–12)**.",
  "Dari current state, **Batch 1, Batch 2, dan Batch 3 sudah CLOSED**. Tersisa **9 batch platform/production (Batch 4–12)**; next implementation target adalah **Batch 4 — Unified Capability + Permission Plane**.",
  "roadmap",
);

tracker = replaceExactlyOnce(
  tracker,
  "## Batch 3 — Plugin / Extension Framework\n\nStatus: **IMPLEMENTED / CLOSURE PENDING**",
  "## Batch 3 — Plugin / Extension Framework\n\nStatus: **CLOSED**",
  "Batch 3 status",
);

tracker = replaceExactlyOnce(
  tracker,
  "ADR: `docs/adr/0024-plugin-extension-framework.md`\nOperations: `docs/extension-operations.md`\nClosure pending: exact final CI + public MCP regression, PR #10 expected-head merge, dan post-merge main verification.",
  "ADR: `docs/adr/0024-plugin-extension-framework.md`\nOperations: `docs/extension-operations.md`\n\nClosure evidence:\n\n- final implementation candidate: `e706aa70f3b9b80fc6ec12c72972a29f3c503639`;\n- exact-head CI `34368041372` — Naming, Format, Lint, Typecheck, Test, dedicated Phase 4 real-process acceptance, Secret Scan, Production Build PASS;\n- exact-head MCP External HTTPS Acceptance `34368041191` — PASS;\n- verification mirror PR #11 menunjuk exact SHA yang sama, dipakai hanya untuk memicu checks, lalu ditutup tanpa merge;\n- PR #10 merged dengan expected-head lock sebagai `af2b3f12f5deeaf2fd50c045998416365f766b9d`;\n- post-merge `main` CI `34368309860`, attempt 2 — full green setelah attempt 1 dibatalkan saat Production Build tanpa perubahan `main` SHA.\n\nBatch 3 resmi `CLOSED`; next implementation batch adalah Batch 4.",
  "Batch 3 closure",
);

tracker = replaceExactlyOnce(
  tracker,
  "Current planning unit:\n\n- **Batch 1: CLOSED**\n- **11 platform/production batches remaining (Batch 2–12)**\n- next: **Batch 2 — Outbound MCP Client + MCP Manager**",
  "Current planning unit:\n\n- **Batch 1: CLOSED**\n- **Batch 2: CLOSED**\n- **Batch 3: CLOSED**\n- **9 platform/production batches remaining (Batch 4–12)**\n- next: **Batch 4 — Unified Capability + Permission Plane**",
  "workload summary",
);

writeFileSync(trackerPath, tracker);

const hardeningPath = "docs/fase6-hardening.md";
let hardening = readFileSync(hardeningPath, "utf8");
hardening = replaceExactlyOnce(
  hardening,
  "- rollback membuat revision baru dan mempertahankan provenance target;\n- remove tidak menghapus revision provenance.\n\nIntegrity gate ini tidak diklaim sebagai vulnerability scanner. Unified grant/revocation dan cross-runtime permission authority tetap Batch 4.",
  "- rollback membuat revision baru dan mempertahankan provenance target;\n- remove tidak menghapus revision provenance.\n\nClosure evidence Batch 3: final candidate `e706aa70f3b9b80fc6ec12c72972a29f3c503639`; exact-head CI `34368041372` PASS; public MCP HTTPS `34368041191` PASS; PR #10 merged dengan expected-head lock sebagai `af2b3f12f5deeaf2fd50c045998416365f766b9d`; post-merge main CI `34368309860` attempt 2 full green.\n\nIntegrity gate ini tidak diklaim sebagai vulnerability scanner. Unified grant/revocation dan cross-runtime permission authority tetap Batch 4.",
  "hardening closure",
);
writeFileSync(hardeningPath, hardening);
