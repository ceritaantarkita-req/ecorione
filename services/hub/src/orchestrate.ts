/**
 * Orkestrasi `POST /v1/chat` — `docs/api-fase1.md` §Hub, langkah 1–10. Ini endpoint inti
 * Fase 1: Ai memanggil Hub, Hub mengorkestrasi Context + Connect + RnD.
 *
 * **Tidak ada fallback diam-diam** (`prd.md` §7 Ai): kegagalan menghubungi
 * Context/Connect/RnD melempar `UpstreamError`, dipetakan ke 502 di `http.ts` — bukan
 * jawaban tanpa konteks yang berpura-pura semuanya baik-baik saja.
 */

import {
  assembleContextPack,
  prefixDigest,
  renderContextPack,
  type EpisodicSummary,
  type StablePrefix,
} from "@ecorione/context-assembly";
import {
  makeId,
  type ActionRequest,
  type ArtifactPointer,
  type ChatRequest,
  type ChatResponse,
  type CoreMemory,
  type Episode,
  type OperationId,
  type RetrievalHit,
  type Timestamp,
} from "@ecorione/shared-schema";
import { httpJson } from "@ecorione/shared-server";
import { buildGenAiSpan } from "@ecorione/shared-telemetry";
import { evaluatePolicy } from "./policy-engine.js";
import type { HubRepository } from "./repository.js";

/**
 * System prompt tetap — **konstanta**, tidak pernah dibangun dinamis dari input
 * (`docs/api-fase1.md` §Hub langkah 5). Bebas pola volatil dengan sengaja: prefix ini
 * bagian dari `StablePrefix` yang di-`assertPrefixCacheable` sebelum dikirim.
 */
export const HUB_SYSTEM_PROMPT = [
  "You are ecorione, a personal AI assistant with long-term memory across sessions.",
  "Answer the user directly and concisely. Use recalled facts and thread history only",
  "when they are actually relevant to the current message.",
].join(" ");

/** Anggaran token context pack. Nilai tetap Fase 1 — belum dikonfigurasi per-request. */
const TOKEN_BUDGET = 8000;

/** Berapa ringkasan episodik thread berjalan yang ditarik (`docs/api-fase1.md` §Hub). */
const EPISODE_LIMIT = 6;
const ARTIFACT_LIMIT = 5;

/** Fase 1 belum menjalankan ringkasan otomatis — ini penyederhanaan sementara yang
 * ditandai jelas, bukan diam-diam (`docs/api-fase1.md` §Context, catatan `GET /v1/episodes`). */
const EPISODE_TEXT_CHAR_LIMIT = 300;

export class UpstreamError extends Error {
  readonly service: string;

  constructor(service: string, cause: unknown) {
    super(
      `Layanan "${service}" tidak bisa dihubungi: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "UpstreamError";
    this.service = service;
  }
}

/**
 * Policy engine wajib membalas `ALLOW` untuk aksi `READ` (cuma 4 kelas lain yang masuk
 * `alwaysRequiresApproval`) — kalau tidak, itu bug policy engine, bukan sesuatu yang boleh
 * dilanjutkan diam-diam (`docs/api-fase1.md` §Hub langkah 3).
 */
export class PolicyEngineBugError extends Error {
  constructor(outcome: string) {
    super(
      `Policy engine membalas "${outcome}" untuk aksi READ — seharusnya selalu ALLOW. ` +
        `Ini bug di policy-engine.ts, bukan sesuatu yang boleh dilanjutkan.`,
    );
    this.name = "PolicyEngineBugError";
  }
}

export interface OrchestrateDeps {
  readonly repo: HubRepository;
  readonly contextUrl: string;
  readonly connectUrl: string;
  readonly rndUrl: string;
  readonly internalToken: string | undefined;
}

interface RetrieveResponse {
  readonly hits: readonly RetrievalHit[];
}
interface ListEpisodesResponse {
  readonly episodes: readonly Episode[];
}
interface ListArtifactsResponse {
  readonly pointers: readonly ArtifactPointer[];
}
interface CompleteResponse {
  readonly reply: string;
  readonly model: string;
  readonly cacheHit: boolean;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheWriteTokens: number;
  };
  readonly cost: {
    readonly actualUsd: number;
    readonly naiveUsd: number;
    readonly savedUsd: number;
    readonly savedPct: number;
  };
  readonly routeReason: string;
}

async function callContext<T>(
  deps: OrchestrateDeps,
  path: string,
  init: { readonly method?: "GET" | "POST"; readonly body?: unknown } = {},
): Promise<T> {
  try {
    return await httpJson<T>(`${deps.contextUrl}${path}`, {
      token: deps.internalToken,
      ...init,
    });
  } catch (err) {
    throw new UpstreamError("Context", err);
  }
}

function episodeToSummary(ep: Episode): EpisodicSummary {
  const text = ep.summary ?? ep.rawText.slice(0, EPISODE_TEXT_CHAR_LIMIT);
  return { id: ep.id, ts: ep.ts, text, provenance: ep.provenance };
}

export async function chat(
  deps: OrchestrateDeps,
  req: ChatRequest,
  now: Timestamp,
): Promise<ChatResponse> {
  const operationId: OperationId = makeId("operation");

  // 1–2. Bangun ActionRequest — chat adalah READ, tidak punya efek samping.
  const actionRequest: ActionRequest = {
    operationId,
    module: "Hub",
    tool: "chat.reply",
    actionClass: "READ",
    args: { sessionId: req.sessionId, scope: req.scope },
    scope: req.scope,
    sensitivity: req.maxSensitivity,
    autonomy: req.autonomy,
    idempotencyKey: null,
  };
  deps.repo.recordAuditEvent({
    type: "ACTION_REQUESTED",
    operationId,
    module: "Hub",
    detail: { tool: actionRequest.tool, actionClass: actionRequest.actionClass },
    now,
  });

  // 3. Evaluasi policy — READ harus selalu ALLOW.
  const { verdict, rule } = evaluatePolicy(actionRequest);
  deps.repo.recordAuditEvent({
    type: "POLICY_EVALUATED",
    operationId,
    module: "Hub",
    detail: { outcome: verdict.outcome, reason: verdict.reason },
    ruleId: rule.id,
    now,
  });
  if (verdict.outcome !== "ALLOW") throw new PolicyEngineBugError(verdict.outcome);

  // 4. Tarik konteks dari Context.
  const coreMemory = await callContext<CoreMemory>(deps, "/v1/core-memory");
  const retrieved = await callContext<RetrieveResponse>(deps, "/v1/retrieve", {
    method: "POST",
    body: {
      query: req.message,
      scopes: [req.scope],
      maxSensitivity: req.maxSensitivity,
      now,
    },
  });
  const episodesRes = await callContext<ListEpisodesResponse>(
    deps,
    `/v1/episodes?sessionId=${encodeURIComponent(req.sessionId)}&limit=${String(EPISODE_LIMIT)}`,
  );
  const artifactsRes = await callContext<ListArtifactsResponse>(
    deps,
    `/v1/artifacts?scope=${encodeURIComponent(req.scope)}&limit=${String(ARTIFACT_LIMIT)}`,
  );

  // 5. Rakit StablePrefix + context pack.
  const prefix: StablePrefix = {
    systemPrompt: HUB_SYSTEM_PROMPT,
    toolDefinitions: [],
    coreMemory,
  };
  const pack = assembleContextPack(
    {
      prefix,
      candidateFacts: retrieved.hits,
      episodicSummaries: episodesRes.episodes.map(episodeToSummary),
      artifactPointers: artifactsRes.pointers,
    },
    { tokenBudget: TOKEN_BUDGET, now },
  );
  const rendered = renderContextPack(pack);

  // 6. Panggil Connect.
  let complete: CompleteResponse;
  try {
    complete = await httpJson<CompleteResponse>(`${deps.connectUrl}/v1/complete`, {
      token: deps.internalToken,
      body: {
        target: "hosted",
        prefix,
        dynamicText: rendered.dynamicText,
        userMessage: req.message,
        sensitivity: req.maxSensitivity,
        operationId,
        now,
      },
    });
  } catch (err) {
    throw new UpstreamError("Connect", err);
  }

  // 7. Audit MODEL_CALLED.
  deps.repo.recordAuditEvent({
    type: "MODEL_CALLED",
    operationId,
    module: "Hub",
    detail: {
      model: complete.model,
      cacheHit: complete.cacheHit,
      actualUsd: complete.cost.actualUsd,
      naiveUsd: complete.cost.naiveUsd,
      routeReason: complete.routeReason,
    },
    now,
  });

  // 8. Tulis dua episode: giliran user, giliran assistant. Balasan hosted **tidak**
  // otomatis trust USER — ditandai asalnya apa adanya lewat sourceApp, bukan disamarkan.
  await callContext(deps, "/v1/episodes", {
    method: "POST",
    body: {
      ts: now,
      rawText: req.message,
      provenance: { sourceApp: "ai", sessionId: req.sessionId },
      scope: req.scope,
      sensitivity: req.maxSensitivity,
      syncClass: "LOCAL_ONLY",
      trust: "USER",
    },
  });
  await callContext(deps, "/v1/episodes", {
    method: "POST",
    body: {
      ts: now,
      rawText: complete.reply,
      provenance: { sourceApp: `connect:${complete.model}`, sessionId: req.sessionId },
      scope: req.scope,
      sensitivity: req.maxSensitivity,
      syncClass: "LOCAL_ONLY",
      trust: "LOCAL_AGENT",
    },
  });

  // 9. Trace ke RnD.
  const span = buildGenAiSpan({
    operation: "chat",
    provider: complete.model.startsWith("local/") ? "ollama" : "anthropic",
    requestModel: complete.model,
    conversationId: req.sessionId,
    usage: complete.usage,
    cost: {
      model: complete.model,
      naiveModel: complete.model,
      usage: complete.usage,
      actualUsd: complete.cost.actualUsd,
      naiveUsd: complete.cost.naiveUsd,
      savedUsd: complete.cost.savedUsd,
      savedPct: complete.cost.savedPct,
      routeReason: complete.routeReason,
      policyVersion: "1",
      optimizerOverheadMs: 0,
      operationId,
    },
  });
  try {
    await httpJson(`${deps.rndUrl}/v1/traces`, {
      token: deps.internalToken,
      body: {
        name: span.name,
        attributes: span.attributes,
        operationId,
        recordedAt: now,
      },
    });
  } catch (err) {
    throw new UpstreamError("RnD", err);
  }

  // 10. Respons ke Ai.
  return {
    operationId,
    sessionId: req.sessionId,
    reply: complete.reply,
    memoryUsed: {
      coreMemoryBlocks: coreMemory.blocks.map((b) => b.label),
      recalledFacts: pack.dynamic.recalledFacts.map((h) => ({
        id: h.fact.id,
        text: h.fact.text,
        score: h.score,
      })),
      episodicSummaries: pack.dynamic.episodicSummaries.map((e) => ({
        id: e.id,
        text: e.text,
      })),
    },
    cost: {
      model: complete.model,
      cacheHit: complete.cacheHit,
      actualUsd: complete.cost.actualUsd,
      naiveUsd: complete.cost.naiveUsd,
      savedUsd: complete.cost.savedUsd,
      savedPct: complete.cost.savedPct,
      routeReason: complete.routeReason,
    },
    policy: { outcome: "ALLOW", reason: verdict.reason, ruleId: rule.id },
  };
}

/** Diekspor untuk `render.test.ts`-style assertion di test — prefix Hub byte-identik. */
export function hubPrefixDigest(coreMemory: CoreMemory): string {
  return prefixDigest({ systemPrompt: HUB_SYSTEM_PROMPT, toolDefinitions: [], coreMemory });
}
