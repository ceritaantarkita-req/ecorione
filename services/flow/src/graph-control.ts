import type { z } from "zod";
import {
  ConditionNodeConfigSchema,
  LoopNodeConfigSchema,
  TransformNodeConfigSchema,
} from "@ecorione/shared-schema";

export function getGraphPath(value: unknown, path?: string): unknown {
  if (path === undefined || path.length === 0) return value;
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined;
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function stringifyTemplateValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return JSON.stringify(value);
}

export function renderGraphTemplate(template: string, input: unknown): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]*)\s*\}\}/g, (_match, rawPath: string) =>
    stringifyTemplateValue(getGraphPath(input, rawPath)),
  );
}

export function transformGraphValue(input: unknown, rawConfig: unknown): unknown {
  const config = TransformNodeConfigSchema.parse(rawConfig) as z.infer<
    typeof TransformNodeConfigSchema
  >;
  if (config.mode === "template") return renderGraphTemplate(config.template ?? "", input);
  if (config.mode === "pick") return getGraphPath(input, config.path);
  const base =
    input !== null && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : { input };
  return { ...base, ...(config.value ?? {}) };
}

function compare(left: unknown, right: unknown): number | null {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
  return null;
}

export function conditionGraphRoute(input: unknown, rawConfig: unknown): "true" | "false" {
  const config = ConditionNodeConfigSchema.parse(rawConfig);
  const actual = getGraphPath(input, config.path);
  let result: boolean;
  switch (config.operator) {
    case "eq":
      result = JSON.stringify(actual) === JSON.stringify(config.value);
      break;
    case "neq":
      result = JSON.stringify(actual) !== JSON.stringify(config.value);
      break;
    case "exists":
      result = actual !== undefined && actual !== null;
      break;
    case "truthy":
      result = Boolean(actual);
      break;
    case "gt":
      result = (compare(actual, config.value) ?? Number.NEGATIVE_INFINITY) > 0;
      break;
    case "gte":
      result = (compare(actual, config.value) ?? Number.NEGATIVE_INFINITY) >= 0;
      break;
    case "lt":
      result = (compare(actual, config.value) ?? Number.POSITIVE_INFINITY) < 0;
      break;
    case "lte":
      result = (compare(actual, config.value) ?? Number.POSITIVE_INFINITY) <= 0;
      break;
  }
  return result ? "true" : "false";
}

export function loopGraphValue(input: unknown, rawConfig: unknown): unknown[] {
  const config = LoopNodeConfigSchema.parse(rawConfig);
  const selected = getGraphPath(input, config.path);
  if (!Array.isArray(selected)) throw new Error("Loop/Map input harus array.");
  if (selected.length > config.maxIterations)
    throw new Error(`Loop/Map melewati maxIterations ${String(config.maxIterations)}.`);
  if (config.mode === "identity") return [...selected];
  return selected.map((item) => getGraphPath(item, config.pickPath));
}

export function graphInputFromEdges(
  inputs: Array<{ sourceNodeId: string; value: unknown }>,
): unknown {
  if (inputs.length === 0) return null;
  if (inputs.length === 1) return inputs[0]!.value;
  return Object.fromEntries(
    inputs
      .sort((a, b) => a.sourceNodeId.localeCompare(b.sourceNodeId))
      .map((entry) => [entry.sourceNodeId, entry.value]),
  );
}
