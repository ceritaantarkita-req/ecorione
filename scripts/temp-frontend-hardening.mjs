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

function replaceRequired(input, before, after, label) {
  if (!input.includes(before)) throw new Error(`${label} target not found`);
  return input.replace(before, after);
}

update("apps/ai/app/space/page.tsx", (input) =>
  input.replace(
    'className={styles.iconButton}\n                            aria-label={`Inspect ${block.type} block`}',
    'className={`${styles.iconButton} ${styles.inspectButton}`}\n                            aria-label={`Inspect ${block.type} block`}',
  ),
);

update("apps/ai/app/space/Space.module.css", (input) => {
  if (input.includes(".inspectButton")) return input;
  return replaceRequired(
    input,
    `.deleteButton {\n  width: auto;\n  padding: 0 7px;\n}`,
    `.inspectButton,\n.deleteButton {\n  width: auto;\n  padding: 0 7px;\n}\n\n.inspectButton[aria-pressed="true"] {\n  border-color: var(--accent);\n  color: var(--text);\n  background: var(--surface-2);\n}`,
    "Space inspect button CSS",
  );
});

update("apps/ai/app/flow/page.tsx", (input) => {
  let text = input;

  if (!text.includes("async function runUiAction(")) {
    text = replaceRequired(
      text,
      `  const selected = nodes.find((node) => node.id === selectedId) ?? null;\n`,
      `  const selected = nodes.find((node) => node.id === selectedId) ?? null;\n\n  async function runUiAction(label: string, action: () => Promise<unknown>): Promise<void> {\n    try {\n      await action();\n    } catch (reason) {\n      const detail = reason instanceof Error ? reason.message : String(reason);\n      setMessage(\`${"${label}"}: ${"${detail}"}\`);\n    }\n  }\n`,
      "Flow UI action guard",
    );
  }

  const oldPoll = `    void refresh();\n    const timer = window.setInterval(() => void refresh(), 1200);`;
  if (text.includes(oldPoll)) {
    text = text.replace(
      oldPoll,
      `    const refreshSafely = () => {\n      void refresh().catch((reason) => {\n        if (!cancelled) {\n          const detail = reason instanceof Error ? reason.message : String(reason);\n          setMessage(\`Run refresh gagal: ${"${detail}"}\`);\n        }\n      });\n    };\n    refreshSafely();\n    const timer = window.setInterval(refreshSafely, 1200);`,
    );
  }

  const handlerReplacements = [
    [
      'onClick={() => void validate()}',
      'onClick={() => void runUiAction("Validasi gagal", validate)}',
    ],
    ['onClick={() => void save()}', 'onClick={() => void runUiAction("Save gagal", save)}'],
    [
      'onClick={() => void runGraph()}',
      'onClick={() => void runUiAction("Run gagal", runGraph)}',
    ],
    [
      'onClick={() => void loadGraph()}',
      'onClick={() => void runUiAction("Load gagal", () => loadGraph())}',
    ],
    [
      'onClick={() => void loadGraph(item.graphId, item.version)}',
      'onClick={() =>\n                    void runUiAction("Load version gagal", () =>\n                      loadGraph(item.graphId, item.version),\n                    )\n                  }',
    ],
    [
      'onClick={() => void decide(node, "APPROVE")}',
      'onClick={() =>\n                      void runUiAction("Approval gagal", () => decide(node, "APPROVE"))\n                    }',
    ],
    [
      'onClick={() => void decide(node, "REJECT")}',
      'onClick={() =>\n                      void runUiAction("Rejection gagal", () => decide(node, "REJECT"))\n                    }',
    ],
    [
      'onClick={() => void submitHuman(node)}',
      'onClick={() =>\n                      void runUiAction("Input gagal", () => submitHuman(node))\n                    }',
    ],
  ];
  for (const [before, after] of handlerReplacements) {
    if (text.includes(before)) text = text.replace(before, after);
  }

  if (!text.includes('aria-label={`Add ${definition.label} node`}')) {
    const marker = `                className={styles.paletteNode}\n`;
    const addition = `                onClick={() => {\n                  const id = newNodeId(definition.kind);\n                  setNodes((current) => {\n                    const index = current.length;\n                    return [\n                      ...current,\n                      {\n                        id,\n                        kind: definition.kind,\n                        version: 1,\n                        label: definition.label,\n                        position: {\n                          x: 72 + (index % 4) * 190,\n                          y: 96 + Math.floor(index / 4) * 100,\n                        },\n                        config: defaultConfig(definition.kind),\n                        secretRefs: [],\n                        limits: {},\n                        retry: {},\n                      },\n                    ];\n                  });\n                  setSelectedId(id);\n                  setValidation(null);\n                  setMessage(\`${"${definition.label}"} ditambahkan ke canvas.\`);\n                }}\n                aria-label={\`Add ${"${definition.label}"} node\`}\n                className={styles.paletteNode}\n`;
    text = replaceRequired(text, marker, addition, "Flow palette click affordance");
  }

  return text;
});

update("apps/ai/app/flow/FlowCanvas.module.css", (input) => {
  let text = input;
  const oldTablet = `@media (max-width: 1050px) {\n  .workspace {\n    grid-template-columns: 160px minmax(620px, 1fr) 260px;\n    overflow-x: auto;\n  }\n\n  .runPanel {\n    grid-template-columns: 300px 1fr;\n  }\n}`;
  const newTablet = `@media (max-width: 1050px) {\n  .workspace {\n    grid-template-columns: minmax(0, 1fr);\n    overflow: visible;\n  }\n\n  .palette {\n    border-right: 0;\n    border-bottom: 1px solid var(--border);\n  }\n\n  .paletteList {\n    display: grid;\n    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));\n  }\n\n  .canvasWrap {\n    min-height: 660px;\n    border-bottom: 1px solid var(--border);\n  }\n\n  .inspector {\n    border-left: 0;\n  }\n\n  .runPanel {\n    grid-template-columns: 300px 1fr;\n  }\n}`;
  if (text.includes(oldTablet)) text = text.replace(oldTablet, newTablet);

  const oldMobile = `  .workspace {\n    min-height: 560px;\n    grid-template-columns: 150px 700px 260px;\n    overflow-x: auto;\n  }`;
  const newMobile = `  .workspace {\n    min-height: 0;\n    grid-template-columns: minmax(0, 1fr);\n    overflow: visible;\n  }\n\n  .canvasWrap {\n    min-height: 600px;\n    overflow-x: auto;\n  }\n\n  .canvas {\n    min-width: 720px;\n    min-height: 560px;\n  }`;
  if (text.includes(oldMobile)) text = text.replace(oldMobile, newMobile);
  return text;
});

update("apps/ai/app/globals.css", (input) => {
  let text = input;
  text = text.replace(
    `  padding: 10px;\n  display: flex;\n  align-items: flex-end;\n  gap: 8px;\n  background: color-mix(in srgb, var(--bg) 94%, transparent);`,
    `  padding: 10px 10px max(10px, env(safe-area-inset-bottom));\n  display: flex;\n  align-items: flex-end;\n  gap: 8px;\n  background: color-mix(in srgb, var(--bg) 94%, transparent);`,
  );
  text = text.replace(
    `  .ai-composer .ecr-btn {\n    min-width: 64px;\n  }`,
    `  .ai-composer .ecr-btn {\n    min-width: 68px;\n    min-height: 44px;\n  }`,
  );
  return text;
});

update("apps/ai/app/navigation.css", (input) =>
  input.replace(
    `  .ecr-theme-switch__item {\n    min-width: 30px;\n    width: 30px;`,
    `  .ecr-theme-switch__item {\n    min-width: 36px;\n    width: 36px;\n    height: 36px;`,
  ),
);
