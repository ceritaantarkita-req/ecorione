import { describe, expect, it } from "vitest";
import {
  conditionGraphRoute,
  getGraphPath,
  graphInputFromEdges,
  loopGraphValue,
  renderGraphTemplate,
  renderGraphValueTemplates,
  transformGraphValue,
} from "./graph-control.js";

describe("graph control primitives", () => {
  it("resolves paths and deterministic templates", () => {
    expect(getGraphPath({ user: { name: "Rani" } }, "user.name")).toBe("Rani");
    expect(renderGraphTemplate("Halo {{ user.name }}", { user: { name: "Rani" } })).toBe(
      "Halo Rani",
    );
  });
  it("renders structured MCP argument templates with bounded deterministic semantics", () => {
    const input = {
      sender: { email: "rani@example.com" },
      body: "Halo",
      score: 91,
      flags: ["important"],
    };
    expect(
      renderGraphValueTemplates(
        {
          to: "{{ sender.email }}",
          subject: "Reply to {{ sender.email }}",
          score: "{{ score }}",
          payload: { text: "{{ body }}", flags: "{{ flags }}" },
        },
        input,
      ),
    ).toEqual({
      to: "rani@example.com",
      subject: "Reply to rani@example.com",
      score: 91,
      payload: { text: "Halo", flags: ["important"] },
    });
    expect(() => {
      let nested: unknown = "value";
      for (let index = 0; index < 18; index += 1) nested = { nested };
      renderGraphValueTemplates(nested, input);
    }).toThrow(/kedalaman/);
  });

  it("transforms and routes without eval", () => {
    expect(transformGraphValue({ a: { b: 7 } }, { mode: "pick", path: "a.b" })).toBe(7);
    expect(
      conditionGraphRoute({ score: 8 }, { path: "score", operator: "gte", value: 7 }),
    ).toBe("true");
  });
  it("bounds loop/map and multi-input aggregation", () => {
    expect(
      loopGraphValue(
        { items: [{ x: 1 }, { x: 2 }] },
        { path: "items", mode: "pick", pickPath: "x", maxIterations: 2 },
      ),
    ).toEqual([1, 2]);
    expect(() => loopGraphValue([1, 2, 3], { mode: "identity", maxIterations: 2 })).toThrow(
      /maxIterations/,
    );
    expect(
      graphInputFromEdges([
        { sourceNodeId: "b", value: 2 },
        { sourceNodeId: "a", value: 1 },
      ]),
    ).toEqual({ a: 1, b: 2 });
  });
});
