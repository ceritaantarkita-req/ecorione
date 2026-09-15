import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(
  resolve(ROOT, "apps/ai/app/settings/Settings.module.css"),
  "utf8",
);

test("Settings keeps asynchronous action feedback visible while the operator is scrolled", () => {
  const statusRule = css.match(/\.status\s*\{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(statusRule, /position:\s*sticky;/u);
  assert.match(statusRule, /top:\s*12px;/u);
  assert.match(statusRule, /z-index:\s*4;/u);
});

test("Settings narrow layout stacks action controls instead of clipping them horizontally", () => {
  const mobile = css.split("@media (max-width: 720px)")[1] ?? "";
  const actionsRule =
    mobile.match(/\.inline,\s*\n\s*\.actions\s*\{([\s\S]*?)\n\s*\}/u)?.[1] ?? "";
  assert.match(actionsRule, /flex-direction:\s*column;/u);
  assert.match(actionsRule, /align-items:\s*stretch;/u);
  assert.match(mobile, /\.actions button\s*\{[\s\S]*?width:\s*100%;/u);
});
