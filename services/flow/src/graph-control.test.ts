import { describe, expect, it } from "vitest";
import { conditionGraphRoute, getGraphPath, graphInputFromEdges, loopGraphValue, renderGraphTemplate, transformGraphValue } from "./graph-control.js";

describe("graph control primitives", () => {
  it("resolves paths and deterministic templates", () => {
    expect(getGraphPath({ user: { name: "Rani" } }, "user.name")).toBe("Rani");
    expect(renderGraphTemplate("Halo {{ user.name }}", { user: { name: "Rani" } })).toBe("Halo Rani");
  });
  it("transforms and routes without eval", () => {
    expect(transformGraphValue({ a: { b: 7 } }, { mode: "pick", path: "a.b" })).toBe(7);
    expect(conditionGraphRoute({ score: 8 }, { path: "score", operator: "gte", value: 7 })).toBe("true");
  });
  it("bounds loop/map and multi-input aggregation", () => {
    expect(loopGraphValue({ items: [{ x: 1 }, { x: 2 }] }, { path: "items", mode: "pick", pickPath: "x", maxIterations: 2 })).toEqual([1, 2]);
    expect(() => loopGraphValue([1, 2, 3], { mode: "identity", maxIterations: 2 })).toThrow(/maxIterations/);
    expect(graphInputFromEdges([{ sourceNodeId: "b", value: 2 }, { sourceNodeId: "a", value: 1 }])).toEqual({ a: 1, b: 2 });
  });
});
