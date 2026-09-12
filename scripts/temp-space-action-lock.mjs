import { readFileSync, writeFileSync } from "node:fs";

const path = "apps/ai/app/space/page.tsx";
let text = readFileSync(path, "utf8");

function required(before, after, label) {
  if (!text.includes(before)) throw new Error(`${label} target not found`);
  text = text.replace(before, after);
}

required(
  'import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";',
  "Space React import",
);

required(
  '  const [notice, setNotice] = useState<string | null>(null);\n',
  `  const [notice, setNotice] = useState<string | null>(null);\n  const [busyAction, setBusyAction] = useState<string | null>(null);\n  const actionLockRef = useRef<string | null>(null);\n\n  async function runLocked(action: string, work: () => Promise<void>): Promise<void> {\n    if (actionLockRef.current !== null) return;\n    actionLockRef.current = action;\n    setBusyAction(action);\n    setNotice(null);\n    try {\n      await work();\n    } catch (err) {\n      setError(err instanceof Error ? err.message : String(err));\n    } finally {\n      if (actionLockRef.current === action) {\n        actionLockRef.current = null;\n        setBusyAction(null);\n      }\n    }\n  }\n`,
  "Space action lock",
);

text = text.replace(
  '<form onSubmit={createPage} className={styles.createForm}>',
  '<form onSubmit={(event) => void runLocked("create-page", () => createPage(event))} className={styles.createForm}>',
);
text = text.replace(
  'disabled={newPageTitle.trim().length === 0}',
  'disabled={busyAction !== null || newPageTitle.trim().length === 0}',
);
text = text.replace(
  '<form className={styles.renameRow} onSubmit={renamePage}>',
  '<form className={styles.renameRow} onSubmit={(event) => void runLocked("rename-page", () => renamePage(event))}>',
);
text = text.replace(
  'disabled={renameDraft.trim().length === 0}',
  'disabled={busyAction !== null || renameDraft.trim().length === 0}',
);
text = text.replaceAll(
  'void moveBlock(block, -1);',
  'void runLocked("move-block", () => moveBlock(block, -1));',
);
text = text.replaceAll(
  'void moveBlock(block, 1);',
  'void runLocked("move-block", () => moveBlock(block, 1));',
);
text = text.replace(
  'disabled={index === 0}',
  'disabled={busyAction !== null || index === 0}',
);
text = text.replace(
  'disabled={index === document.blocks.length - 1}',
  'disabled={busyAction !== null || index === document.blocks.length - 1}',
);
text = text.replace(
  'void deleteBlock(block);',
  'void runLocked("delete-block", () => deleteBlock(block));',
);
text = text.replace(
  'aria-label={`Delete ${block.type} block`}\n',
  'aria-label={`Delete ${block.type} block`}\n                            disabled={busyAction !== null}\n',
);
text = text.replace(
  'onClick={() => void addBlock()}',
  'disabled={busyAction !== null}\n                    onClick={() => void runLocked("add-block", addBlock)}',
);
text = text.replace(
  'onClick={() => void saveBlock()}',
  'disabled={busyAction !== null}\n                      onClick={() => void runLocked("save-block", saveBlock)}',
);
text = text.replace(
  'onClick={() => void resolveBlock()}',
  'disabled={busyAction !== null}\n                      onClick={() => void runLocked("resolve-block", resolveBlock)}',
);
text = text.replace(
  '<form onSubmit={saveMemory} className={styles.memoryForm}>',
  '<form onSubmit={(event) => void runLocked("save-memory", () => saveMemory(event))} className={styles.memoryForm}>',
);
text = text.replace(
  '<button type="submit" className={styles.buttonPrimary}>\n                  Save to Context',
  '<button type="submit" className={styles.buttonPrimary} disabled={busyAction !== null}>\n                  {busyAction === "save-memory" ? "Saving…" : "Save to Context"}',
);
text = text.replace(
  'aria-label="Selected block JSON"\n',
  'aria-label="Selected block JSON"\n                    disabled={busyAction !== null}\n',
);
text = text.replace(
  'aria-label="Page title"\n',
  'aria-label="Page title"\n                      disabled={busyAction !== null}\n',
);

writeFileSync(path, text);
