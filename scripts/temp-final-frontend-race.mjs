import { readFileSync, writeFileSync } from "node:fs";

function update(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) {
    console.log(`unchanged ${path}`);
    return;
  }
  writeFileSync(path, after);
  console.log(`updated ${path}`);
}

update("apps/ai/app/flow/page.tsx", (input) => {
  let text = input;
  if (!text.includes("const actionLockRef = useRef(false);")) {
    const marker = "  const canvasRef = useRef<HTMLDivElement>(null);\n";
    if (!text.includes(marker)) throw new Error("Flow canvas ref marker missing");
    text = text.replace(marker, `${marker}  const actionLockRef = useRef(false);\n`);
  }

  const oldAction = `  async function runUiAction(label: string, action: () => Promise<unknown>): Promise<void> {\n    try {\n      await action();\n    } catch (reason) {\n      const detail = reason instanceof Error ? reason.message : String(reason);\n      setMessage(\`${"${label}"}: ${"${detail}"}\`);\n    }\n  }`;
  const newAction = `  async function runUiAction(label: string, action: () => Promise<unknown>): Promise<void> {\n    if (actionLockRef.current) return;\n    actionLockRef.current = true;\n    setBusy(true);\n    try {\n      await action();\n    } catch (reason) {\n      const detail = reason instanceof Error ? reason.message : String(reason);\n      setMessage(\`${"${label}"}: ${"${detail}"}\`);\n    } finally {\n      actionLockRef.current = false;\n      setBusy(false);\n    }\n  }`;
  if (text.includes(oldAction)) text = text.replace(oldAction, newAction);
  else if (!text.includes("if (actionLockRef.current) return;")) {
    throw new Error("Flow runUiAction target missing");
  }
  return text;
});

update("apps/ai/app/space/page.tsx", (input) => {
  let text = input;
  const replacements = [
    [
      'placeholder="New page"\n              aria-label="New page title"',
      'placeholder="New page"\n              aria-label="New page title"\n              disabled={busyAction !== null}',
    ],
    [
      'onClick={() => setSelectedPageId(page.id)}\n                  className=',
      'onClick={() => setSelectedPageId(page.id)}\n                  disabled={busyAction !== null}\n                  className=',
    ],
    [
      'className={styles.button}\n                      onClick={() => {\n                        setRenameDraft(document.page.title);',
      'className={styles.button}\n                      disabled={busyAction !== null}\n                      onClick={() => {\n                        setRenameDraft(document.page.title);',
    ],
    [
      'className={styles.button}\n                    onClick={() => setRenaming(true)}',
      'className={styles.button}\n                    disabled={busyAction !== null}\n                    onClick={() => setRenaming(true)}',
    ],
    [
      'aria-pressed={selectedBlockId === block.id}\n                            onClick=',
      'aria-pressed={selectedBlockId === block.id}\n                            disabled={busyAction !== null}\n                            onClick=',
    ],
    [
      'className={`${styles.kindButton} ${kind === draftKind ? styles.kindButtonActive : ""}`}\n                      onClick=',
      'className={`${styles.kindButton} ${kind === draftKind ? styles.kindButtonActive : ""}`}\n                      disabled={busyAction !== null}\n                      onClick=',
    ],
    [
      'spellCheck={false}\n                  aria-label={`${draftKind} block JSON`}',
      'spellCheck={false}\n                  aria-label={`${draftKind} block JSON`}\n                  disabled={busyAction !== null}',
    ],
    [
      'className={styles.memoryButton}\n                    onClick=',
      'className={styles.memoryButton}\n                    disabled={busyAction !== null}\n                    onClick=',
    ],
    [
      'placeholder="label"\n                  aria-label="Core memory label"',
      'placeholder="label"\n                  aria-label="Core memory label"\n                  disabled={busyAction !== null}',
    ],
    [
      'placeholder="description"\n                  aria-label="Core memory description"',
      'placeholder="description"\n                  aria-label="Core memory description"\n                  disabled={busyAction !== null}',
    ],
    [
      'placeholder="Context-owned value"\n                  aria-label="Core memory value"',
      'placeholder="Context-owned value"\n                  aria-label="Core memory value"\n                  disabled={busyAction !== null}',
    ],
  ];
  for (const [before, after] of replacements) {
    if (text.includes(before)) text = text.replace(before, after);
  }
  return text;
});
