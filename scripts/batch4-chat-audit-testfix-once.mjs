import { readFileSync, writeFileSync } from "node:fs";

const path = "test/chat-loop.test.ts";
let text = readFileSync(path, "utf8");
const from = `    // Audit: urutan ACTION_REQUESTED → POLICY_EVALUATED → MODEL_CALLED (bukan urutan\n    // lain — ini mengunci ulang perbaikan \`ORDER BY ts ASC, rowid ASC\` di repository.ts).`;
const to = `    // Audit: Batch 4 menambahkan authority decision di antara policy dan provider call.\n    // Urutan tetap deterministik dan mengunci ulang ORDER BY ts ASC, rowid ASC.`;
if (!text.includes(from)) throw new Error("audit comment anchor missing");
text = text.replace(from, to);
const oldExpected = `    expect(events.map((e) => e.type)).toEqual([\n      "ACTION_REQUESTED",\n      "POLICY_EVALUATED",\n      "MODEL_CALLED",\n    ]);`;
const newExpected = `    expect(events.map((e) => e.type)).toEqual([\n      "ACTION_REQUESTED",\n      "POLICY_EVALUATED",\n      "CAPABILITY_AUTHORIZED",\n      "MODEL_CALLED",\n    ]);`;
if (!text.includes(oldExpected)) throw new Error("audit expectation anchor missing");
text = text.replace(oldExpected, newExpected);
writeFileSync(path, text);
console.log("Batch 4 chat audit regression expectation updated.");
