import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureLocalEnv, parseSimpleEnv, upsertEnvValue } from "../scripts/ecorione-engine.mjs";

const roots = [];

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ecorione-engine-"));
  roots.push(root);
  return root;
}

describe("ECORIONE local engine bootstrap", () => {
  it("parses simple env values without treating comments as config", () => {
    expect(
      parseSimpleEnv('# note\nA=one\nB="two words"\nC=\'three words\'\n\n'),
    ).toEqual({ A: "one", B: "two words", C: "three words" });
  });

  it("updates one env value without duplicating its key", () => {
    const next = upsertEnvValue("A=one\nB=two\n", "B", "changed");
    expect(next.match(/^B=/gm)).toHaveLength(1);
    expect(parseSimpleEnv(next).B).toBe("changed");
  });

  it("creates .env and generates local secrets while preserving configured values", () => {
    const root = tempRoot();
    writeFileSync(
      join(root, ".env.example"),
      [
        "ECORIONE_INTERNAL_TOKEN=",
        "ECORIONE_CONNECT_VAULT_MASTER_KEY=",
        "ECORIONE_LOCAL_MODEL=qwen3:8b-instruct-q4_K_M",
        "",
      ].join("\n"),
    );

    const first = ensureLocalEnv(root);
    const written = parseSimpleEnv(readFileSync(join(root, ".env"), "utf8"));

    expect(first.created).toBe(true);
    expect(first.generated.sort()).toEqual(
      ["ECORIONE_CONNECT_VAULT_MASTER_KEY", "ECORIONE_INTERNAL_TOKEN"].sort(),
    );
    expect(written.ECORIONE_INTERNAL_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(written.ECORIONE_CONNECT_VAULT_MASTER_KEY).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(written.ECORIONE_LOCAL_MODEL).toBe("qwen3:8b-instruct-q4_K_M");

    const token = written.ECORIONE_INTERNAL_TOKEN;
    const vaultKey = written.ECORIONE_CONNECT_VAULT_MASTER_KEY;
    const second = ensureLocalEnv(root);
    const afterSecond = parseSimpleEnv(readFileSync(join(root, ".env"), "utf8"));

    expect(second.created).toBe(false);
    expect(second.generated).toEqual([]);
    expect(afterSecond.ECORIONE_INTERNAL_TOKEN).toBe(token);
    expect(afterSecond.ECORIONE_CONNECT_VAULT_MASTER_KEY).toBe(vaultKey);
  });
});
