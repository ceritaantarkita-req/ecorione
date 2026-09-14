import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateAgenticManifest(manifest, repoRoot) {
  if (!isRecord(manifest)) throw new Error("agentic manifest harus object");
  if (manifest.version !== 1) throw new Error("agentic manifest version harus 1");
  if (manifest.suite !== "ecorione-local-agentic-v1") throw new Error("suite W15 tidak dikenal");
  if (manifest.repetitions !== 3) throw new Error("W15 wajib memakai pass^3");
  if (!Number.isInteger(manifest.maxSteps) || manifest.maxSteps < 2 || manifest.maxSteps > 8) {
    throw new Error("maxSteps W15 harus integer 2..8");
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0 || manifest.cases.length > 50) {
    throw new Error("W15 harus punya 1..50 kasus");
  }

  const ids = new Set();
  for (const item of manifest.cases) {
    if (!isRecord(item) || typeof item.id !== "string" || !/^W15-\d{3}$/u.test(item.id)) {
      throw new Error("id kasus W15 tidak valid");
    }
    if (ids.has(item.id)) throw new Error(`id W15 duplikat: ${item.id}`);
    ids.add(item.id);
    if (!isRecord(item.origin) || !["bug", "task"].includes(item.origin.kind)) {
      throw new Error(`${item.id}: provenance harus bug/task nyata`);
    }
    if (typeof item.origin.source !== "string" || typeof item.origin.ref !== "string") {
      throw new Error(`${item.id}: provenance tidak lengkap`);
    }
    const sourceText = readFileSync(resolve(repoRoot, item.origin.source), "utf8");
    if (!sourceText.includes(item.origin.ref)) {
      throw new Error(`${item.id}: provenance ref tidak ditemukan: ${item.origin.ref}`);
    }
    if (typeof item.prompt !== "string" || item.prompt.trim().length < 20) {
      throw new Error(`${item.id}: prompt terlalu pendek`);
    }
    if (!Array.isArray(item.tools) || item.tools.length < 2) {
      throw new Error(`${item.id}: minimal dua tool diperlukan agar selection benar-benar diukur`);
    }
    const toolNames = new Set();
    for (const tool of item.tools) {
      if (!isRecord(tool) || typeof tool.name !== "string" || typeof tool.description !== "string") {
        throw new Error(`${item.id}: definisi tool tidak valid`);
      }
      if (toolNames.has(tool.name)) throw new Error(`${item.id}: tool duplikat ${tool.name}`);
      toolNames.add(tool.name);
      if (!isRecord(tool.args) || !isRecord(tool.result)) {
        throw new Error(`${item.id}: fixture args/result tool harus object`);
      }
    }
    if (!isRecord(item.expected) || typeof item.expected.firstTool !== "string") {
      throw new Error(`${item.id}: expected.firstTool wajib ada`);
    }
    if (!toolNames.has(item.expected.firstTool)) {
      throw new Error(`${item.id}: expected.firstTool tidak tersedia`);
    }
  }
  return manifest;
}

export function buildAgentSystemPrompt(item) {
  const tools = item.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    args: tool.args,
  }));
  return [
    "You are being evaluated as a bounded local agent.",
    "Return one JSON object only. Do not use markdown fences.",
    "Never claim a tool result before the harness sends TOOL_OBSERVATION.",
    "For a tool step return: {\"phase\":\"tool\",\"reason\":\"brief rationale\",\"tool\":\"name\",\"args\":{...}}.",
    "For the final step return: {\"phase\":\"final\",\"answer\":\"concise answer\",\"verified\":true}.",
    "The reason field is a short decision rationale, not hidden chain-of-thought.",
    "Base final verification only on observed tool output and preserve important literal values from that output.",
    `Available tools: ${JSON.stringify(tools)}`,
  ].join("\n");
}

export function parseAgentAction(text) {
  if (typeof text !== "string") throw new Error("model output bukan string");
  const trimmed = text.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model output tidak berisi JSON object");
  const parsed = JSON.parse(trimmed.slice(start, end + 1));
  if (!isRecord(parsed)) throw new Error("agent action harus object");
  if (parsed.phase === "tool") {
    if (typeof parsed.reason !== "string" || parsed.reason.trim().length === 0) {
      throw new Error("tool action wajib punya reason singkat");
    }
    if (typeof parsed.tool !== "string" || !isRecord(parsed.args)) {
      throw new Error("tool action tidak lengkap");
    }
    return parsed;
  }
  if (parsed.phase === "final") {
    if (typeof parsed.answer !== "string" || typeof parsed.verified !== "boolean") {
      throw new Error("final action tidak lengkap");
    }
    return parsed;
  }
  throw new Error("phase agent harus tool atau final");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function executeFixtureTool(item, action) {
  const tool = item.tools.find((candidate) => candidate.name === action.tool);
  if (tool === undefined) {
    return { ok: false, error: `tool tidak tersedia: ${action.tool}` };
  }
  if (!sameJson(action.args, tool.args)) {
    return {
      ok: false,
      error: `args salah untuk ${action.tool}; expected ${JSON.stringify(tool.args)}`,
    };
  }
  return { ok: true, tool: tool.name, result: tool.result };
}

function includesAll(haystack, needles) {
  const normalized = haystack.toLowerCase();
  return (needles ?? []).every((needle) => normalized.includes(String(needle).toLowerCase()));
}

function includesNone(haystack, needles) {
  const normalized = haystack.toLowerCase();
  return (needles ?? []).every((needle) => !normalized.includes(String(needle).toLowerCase()));
}

export function scoreAgentTrace(item, trace) {
  const toolActions = trace.actions.filter((action) => action.phase === "tool");
  const finalAction = [...trace.actions].reverse().find((action) => action.phase === "final");
  const executedTools = trace.executions.filter((entry) => entry.ok).map((entry) => entry.tool);
  const selectedTools = toolActions.map((action) => action.tool);
  const forbidden = item.expected.forbiddenTools ?? [];
  const checks = {
    reason: toolActions.length > 0 && toolActions.every((action) => action.reason.trim().length > 0),
    tool: selectedTools[0] === item.expected.firstTool && forbidden.every((name) => !selectedTools.includes(name)),
    execute: executedTools.includes(item.expected.firstTool),
    observe: trace.observations.length > 0,
    verify:
      finalAction !== undefined &&
      finalAction.verified === true &&
      includesAll(finalAction.answer, item.expected.finalMustContain) &&
      includesNone(finalAction.answer, item.expected.finalMustNotContain),
  };
  return {
    pass: Object.values(checks).every(Boolean),
    checks,
    selectedTools,
    executedTools,
    finalAnswer: finalAction?.answer ?? null,
  };
}
