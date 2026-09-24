import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CANONICAL_STANDALONE_FLOW_URL = "http://127.0.0.1:17028";
const CANONICAL_COMPOSE_FLOW_URL = "http://flow:17028";

describe("A-13 Space Flow port contract", () => {
  it("Space standalone entrypoint resolves ECORIONE_FLOW_URL through the canonical helper", () => {
    const source = readFileSync("services/space/src/main.ts", "utf8");
    expect(source).toContain("resolveSpaceFlowUrl(process.env.ECORIONE_FLOW_URL)");
    expect(source).not.toContain("http://127.0.0.1:17029");
  });

  it("Space HTTP default points at canonical Flow port 17028", () => {
    const source = readFileSync("services/space/src/http.ts", "utf8");
    expect(source).toContain(
      `DEFAULT_FLOW_URL = "${CANONICAL_STANDALONE_FLOW_URL}"`,
    );
    expect(source).toContain("resolveSpaceFlowUrl(options.flowUrl)");
    expect(source).not.toContain("http://127.0.0.1:17029");
  });

  it("desktop and staging Compose keep their explicit Flow service override unchanged", () => {
    for (const path of ["desktop/compose.yml", "deploy/compose.yml"]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain(
        `ECORIONE_FLOW_URL: ${CANONICAL_COMPOSE_FLOW_URL}`,
      );
    }
  });

  it("environment and engine port map agree on standalone Flow 17028", () => {
    const env = readFileSync(".env.example", "utf8");
    const engine = readFileSync("scripts/ecorione-engine.mjs", "utf8");
    expect(env).toContain(
      `ECORIONE_FLOW_URL=${CANONICAL_STANDALONE_FLOW_URL}`,
    );
    expect(engine).toContain(
      `["Flow", "${CANONICAL_STANDALONE_FLOW_URL}/healthz"]`,
    );
  });
});
