import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const startScript = await readFile(
  new URL("../.devcontainer/start.sh", import.meta.url),
  "utf8",
);
const devcontainer = JSON.parse(
  await readFile(new URL("../.devcontainer/devcontainer.json", import.meta.url), "utf8"),
);

describe("Codespaces development profile", () => {
  it("uses the canonical local engine for the full Phase 4 runtime", () => {
    expect(startScript).toContain("pnpm engine:start");
    expect(startScript).toContain("ECORIONE_TEMPORAL_USE_DOCKER=1");
    expect(startScript).toContain("ECORIONE_ENGINE_NO_OPEN=1");
    expect(startScript).toContain("ECORIONE_AI_PORT=3000");
    expect(startScript).not.toContain("pnpm dev\n");
  });

  it("forwards only the Ai preview by default", () => {
    expect(devcontainer.forwardPorts).toEqual([3000]);
    expect(devcontainer.portsAttributes?.["3000"]).toMatchObject({
      label: "ECORIONE Ai preview",
      protocol: "http",
    });
  });
});
