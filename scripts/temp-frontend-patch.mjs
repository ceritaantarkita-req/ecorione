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

update("apps/ai/app/space/page.tsx", (input) => {
  const inspectLabel = 'aria-label={`Inspect ${block.type} block`}';
  if (input.includes(inspectLabel)) return input;
  const marker = '<span className={styles.blockActions}>';
  if (!input.includes(marker)) throw new Error("Space block action marker not found");
  const replacement = `<span className={styles.blockActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={\`Inspect \${block.type} block\`}
                            aria-pressed={selectedBlockId === block.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedBlockId(block.id);
                            }}
                          >
                            Inspect
                          </button>`;
  return input.replace(marker, replacement);
});

update("apps/ai/app/ops/page.tsx", (input) => {
  let output = input.replace(
    '          <p className={styles.eyebrow}>ECORIONE OPERATIONS</p>\n',
    "",
  );
  const oldError =
    '      {error !== null ? <p className={styles.error}>Ops fetch failed: {error}</p> : null}\n';
  if (output.includes(oldError)) {
    output = output.replace(
      oldError,
      `      {error !== null ? (
        <p className={styles.error} role="alert">
          Ops fetch failed: {error}
        </p>
      ) : null}
`,
    );
  } else if (!output.includes('className={styles.error} role="alert"')) {
    throw new Error("Ops error target not found");
  }
  return output;
});
