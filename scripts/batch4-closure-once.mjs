import { readFileSync, writeFileSync } from "node:fs";

const path = "docs/EXECUTION-PROGRESS.md";
let text = readFileSync(path, "utf8");

function replace(from, to) {
  if (!text.includes(from)) throw new Error(`tracker anchor missing: ${from.slice(0, 120)}`);
  text = text.replace(from, to);
}

replace(
`### Main

Batch 3 closure docs merged ke \`main\` sebagai:

- \`df00c2bafad2449722293eef803fa8873921fd53\`
- final post-closure main CI \`34369678467\`: full green

### Active execution

- Batch 1 status: **CLOSED**
- Batch 2 status: **CLOSED**
- Batch 3 status: **CLOSED**
- Batch 4 status: **IMPLEMENTED / CLOSURE PENDING**
- active branch: \`agent/unified-capability-permission-plane-20260909\`
- PR: #13 (draft sampai exact-head evidence lengkap)
- next after Batch 4 closure: **Batch 5 — Native Multimodal Pipeline**`,
`### Main

Batch 4 implementation merged ke \`main\` sebagai:

- \`455b5cef72d5847b67ddedebc81471432fb0ba42\`
- post-merge main CI \`34380385839\`: full green

### Active execution

- Batch 1 status: **CLOSED**
- Batch 2 status: **CLOSED**
- Batch 3 status: **CLOSED**
- Batch 4 status: **CLOSED**
- next implementation target: **Batch 5 — Native Multimodal Pipeline**`,
);

replace(
`Dari current state, **Batch 1, Batch 2, dan Batch 3 sudah CLOSED**. Batch 4 sudah diimplementasikan dan sedang menunggu closure evidence; secara roadmap masih tersisa **9 batch (Batch 4–12)** sampai Batch 4 benar-benar CLOSED. Setelah closure, next implementation target adalah **Batch 5 — Native Multimodal Pipeline**.`,
`Dari current state, **Batch 1–4 sudah CLOSED**. Tersisa **8 batch platform/production (Batch 5–12)**; next implementation target adalah **Batch 5 — Native Multimodal Pipeline**.`,
);

replace(
`## Batch 4 — Unified Capability + Permission Plane

Status: **IMPLEMENTED / CLOSURE PENDING**`,
`## Batch 4 — Unified Capability + Permission Plane

Status: **CLOSED**`,
);

replace(
`Closure masih membutuhkan exact-final-head CI + MCP External HTTPS PASS, PR #13 expected-head merge, post-merge \`main\` verification, lalu tracker closure update.`,
`Closure evidence:

- final exact PR head: \`c23bad4da6eff453e35b72b4167c0c74554d70f3\`;
- exact-head CI \`34380136146\` — Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, dan Production Build PASS;
- exact-head MCP External HTTPS Acceptance \`34380136158\` — PASS;
- focused chat-loop authority audit regression \`34379954762\` — PASS;
- PR #13 merged dengan expected-head lock sebagai \`455b5cef72d5847b67ddedebc81471432fb0ba42\`;
- post-merge \`main\` CI \`34380385839\` — full green.

Batch 4 resmi **CLOSED**; next implementation batch adalah Batch 5.`,
);

replace(
`## Batch 5 — Native Multimodal Pipeline

Status: **PLANNED**`,
`## Batch 5 — Native Multimodal Pipeline

Status: **PLANNED — NEXT**`,
);

writeFileSync(path, text);
console.log("Batch 4 closure tracker updated.");
