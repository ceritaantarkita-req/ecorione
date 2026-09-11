import { describe, expect, it } from "vitest";
import {
  isEcorioneContainerRow,
  parseArgs,
  sha256Hex,
  summarizeContainerRows,
} from "../scripts/local-persistence-restart-evidence.mjs";

describe("local persistence restart evidence helpers", () => {
  it("parses supported phases and custom state path", () => {
    expect(parseArgs([])).toMatchObject({
      phase: "inventory",
      statePath: ".ecorione/evidence/local-persistence-restart-state.json",
    });
    expect(
      parseArgs(["--phase", "baseline", "--state", ".ecorione/evidence/custom.json"]),
    ).toEqual({
      phase: "baseline",
      statePath: ".ecorione/evidence/custom.json",
    });
  });

  it("rejects unknown phases and arguments", () => {
    expect(() => parseArgs(["--phase", "explode"])).toThrow("Unknown phase");
    expect(() => parseArgs(["--wat"])).toThrow("Unknown argument");
  });

  it("computes stable SHA-256 digests", () => {
    expect(sha256Hex(Buffer.from("ecorione", "utf8"))).toBe(
      "ae667c28b9c3e6ead45f084a51232319596382413fef4669b63d45a329cfc8db",
    );
  });

  it("selects only ECORIONE-owned container candidates", () => {
    const rows = [
      {
        Names: "ecorione-temporal",
        Image: "temporalio/auto-setup:1.29.7",
        State: "running",
        Status: "Up 3 hours",
        Labels: "",
      },
      {
        Names: "random-postgres",
        Image: "postgres:17",
        State: "running",
        Status: "Up 3 hours",
        Labels: "com.docker.compose.project=ecorione",
      },
      {
        Names: "supabase_db_Amand",
        Image: "postgres:15",
        State: "running",
        Status: "Up 2 days",
        Labels: "com.docker.compose.project=supabase",
      },
    ];

    expect(isEcorioneContainerRow(rows[0])).toBe(true);
    expect(isEcorioneContainerRow(rows[1])).toBe(true);
    expect(isEcorioneContainerRow(rows[2])).toBe(false);
    expect(summarizeContainerRows(rows).map((row) => row.name)).toEqual([
      "ecorione-temporal",
      "random-postgres",
    ]);
  });
});
