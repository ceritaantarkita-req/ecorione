from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing patch marker in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Clean imports in the newly added runtime.
replace_once(
    "services/hub/src/voice-runtime.ts",
    'import {\n  VoiceChunkConflictError,\n  VoiceSessionStore,\n  type VoiceSessionNotFoundError,\n} from "./voice-store.js";',
    'import type { VoiceSessionStore } from "./voice-store.js";',
)
replace_once(
    "services/hub/src/voice-runtime.ts",
    '\nexport { VoiceChunkConflictError, VoiceSessionStore };\nexport type { VoiceSessionNotFoundError };\n',
    '\n',
)

# Reuse Batch 5 inference routing / authority logic.
replace_once(
    "services/hub/src/multimodal-http.ts",
    "function requestedRoutes(",
    "export function requestedRoutes(",
)
replace_once(
    "services/hub/src/multimodal-http.ts",
    "function authorizeInference(input: {",
    "export function authorizeInference(input: {",
)

# Hub chat: add local/hosted target selection + cancellation without changing public /v1/chat defaults.
p = Path("services/hub/src/orchestrate.ts")
text = p.read_text()
text = text.replace(
    "  type RetrievalHit,\n  type Timestamp,",
    "  type RetrievalHit,\n  type SyncClass,\n  type Timestamp,",
    1,
)
text = text.replace(
    '  init: { readonly method?: "GET" | "POST"; readonly body?: unknown } = {},',
    '  init: {\n    readonly method?: "GET" | "POST";\n    readonly body?: unknown;\n    readonly signal?: AbortSignal | undefined;\n  } = {},',
    1,
)
complete_marker = """interface CompleteResponse {
  readonly reply: string;
  readonly model: string;
  readonly responseModel: string;
  readonly cacheHit: boolean;
  readonly usage: TokenUsage;
  readonly cost: CallCostRecord;
  readonly routeReason: string;
}
"""
if complete_marker not in text:
    raise SystemExit("missing CompleteResponse marker")
text = text.replace(
    complete_marker,
    complete_marker
    + """export interface ChatExecutionOptions {
  readonly target?: "hosted" | "local" | undefined;
  readonly syncClass?: SyncClass | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly sourceApp?: string | undefined;
}
""",
    1,
)
old_sig = """export async function chat(
  deps: OrchestrateDeps,
  req: ChatRequest,
  now: Timestamp,
): Promise<ChatResponse> {
  const operationId: OperationId = makeId("operation");"""
new_sig = """export async function chat(
  deps: OrchestrateDeps,
  req: ChatRequest,
  now: Timestamp,
  options: ChatExecutionOptions = {},
): Promise<ChatResponse> {
  const target = options.target ?? "hosted";
  const hosted = target === "hosted";
  const syncClass = options.syncClass ?? (hosted ? "CLOUD_ALLOWED" : "LOCAL_ONLY");
  const operationId: OperationId = makeId("operation");"""
if old_sig not in text:
    raise SystemExit("missing chat signature marker")
text = text.replace(old_sig, new_sig, 1)
start = text.index('  const workspaceId = req.workspaceId ?? assertId("workspace", "ws_personal");')
end_marker = """  if (authority.outcome === "DENY") {
    throw new CapabilityAuthorityDeniedError(authority.reason);
  }
"""
end = text.index(end_marker, start) + len(end_marker)
authority = """  const workspaceId = req.workspaceId ?? assertId("workspace", "ws_personal");
  const capabilityId = (hosted ? "model.invoke.hosted" : "model.invoke.local") as CapabilityId;
  const permissionIds = (hosted
    ? ["model.invoke", "network.connect", "provider.spend"]
    : ["model.invoke", "execution.local"]) as PermissionId[];
  const authority = deps.authority.authorize({
    operationId,
    workspaceId,
    subject: { kind: "model", id: target },
    capabilityId,
    permissionIds,
    scope: req.scope,
    sensitivity: req.maxSensitivity,
    autonomy: req.autonomy,
  });
  deps.repo.recordAuditEvent({
    type: authority.outcome === "ALLOW" ? "CAPABILITY_AUTHORIZED" : "CAPABILITY_DENIED",
    operationId,
    module: "Hub",
    detail: {
      workspaceId,
      subject: { kind: "model", id: target },
      capabilityId,
      permissionIds,
      scope: req.scope,
      sensitivity: req.maxSensitivity,
      outcome: authority.outcome,
    },
    now,
  });
  if (authority.outcome === "DENY") {
    throw new CapabilityAuthorityDeniedError(authority.reason);
  }
"""
text = text[:start] + authority + text[end:]
text = text.replace('    syncClass: "CLOUD_ALLOWED",', "    syncClass,", 1)
text = text.replace(
    "  // Chat Fase 1 is hosted. Only memory explicitly eligible for hosted plaintext egress may leave the machine.\n",
    "  // Hosted turns filter Context to cloud-eligible data. Local turns remain inside the local boundary.\n",
    1,
)
text = text.replace(
    '    `/v1/core-memory?scope=${scope}&maxSensitivity=${max}&hostedEligible=1`,\n  );',
    '    `/v1/core-memory?scope=${scope}&maxSensitivity=${max}&hostedEligible=${hosted ? "1" : "0"}`,\n    { signal: options.signal },\n  );',
    1,
)
text = text.replace(
    "      hostedEligibleOnly: true,\n      now,",
    "      hostedEligibleOnly: hosted,\n      now,\n      signal: options.signal,",
    1,
)
text = text.replace(
    '    `/v1/episodes?sessionId=${encodeURIComponent(req.sessionId)}&limit=${String(EPISODE_LIMIT)}&hostedEligible=1`,\n  );',
    '    `/v1/episodes?sessionId=${encodeURIComponent(req.sessionId)}&limit=${String(EPISODE_LIMIT)}&hostedEligible=${hosted ? "1" : "0"}`,\n    { signal: options.signal },\n  );',
    1,
)
text = text.replace(
    '    `/v1/artifacts?scope=${scope}&maxSensitivity=${max}&limit=${String(ARTIFACT_LIMIT)}&hostedEligible=1`,\n  );',
    '    `/v1/artifacts?scope=${scope}&maxSensitivity=${max}&limit=${String(ARTIFACT_LIMIT)}&hostedEligible=${hosted ? "1" : "0"}`,\n    { signal: options.signal },\n  );',
    1,
)
text = text.replace('        target: "hosted",', "        target,", 1)
# Complete call is the first httpJson block containing `now` after target.
needle = """        now,
      },
    });"""
pos = text.find(needle, text.find("target,"))
if pos < 0:
    raise SystemExit("missing Connect complete options marker")
text = text[:pos] + text[pos:].replace(
    needle,
    """        now,
      },
      signal: options.signal,
    });""",
    1,
)
text = text.replace(
    '      provenance: { sourceApp: "ai", sessionId: req.sessionId },',
    '      provenance: { sourceApp: options.sourceApp ?? "ai", sessionId: req.sessionId },',
    1,
)
text = text.replace(
    '      syncClass: "CLOUD_ALLOWED",\n      trust: "USER",',
    "      syncClass,\n      trust: \"USER\",",
    1,
)
text = text.replace('      trust: "HOSTED_AGENT",', '      trust: hosted ? "HOSTED_AGENT" : "LOCAL_AGENT",', 1)
text = text.replace('      syncClass: "CLOUD_ALLOWED",', "      syncClass,", 1)
text = text.replace(
    '      trust: "USER",\n    },\n  });',
    '      trust: "USER",\n    },\n    signal: options.signal,\n  });',
    1,
)
text = text.replace(
    '      trust: hosted ? "HOSTED_AGENT" : "LOCAL_AGENT",\n    },\n  });',
    '      trust: hosted ? "HOSTED_AGENT" : "LOCAL_AGENT",\n    },\n    signal: options.signal,\n  });',
    1,
)
text = text.replace(
    "      body: { name: span.name, attributes: span.attributes, operationId, recordedAt: now },\n    });",
    "      body: { name: span.name, attributes: span.attributes, operationId, recordedAt: now },\n      signal: options.signal,\n    });",
    1,
)
p.write_text(text)

# Connect provider cancellation.
replace_once(
    "services/connect/src/providers/local.ts",
    "export async function callLocal(input: LocalCallInput): Promise<LocalCallResult> {",
    "export async function callLocal(\n  input: LocalCallInput,\n  signal?: AbortSignal,\n): Promise<LocalCallResult> {",
)
replace_once(
    "services/connect/src/providers/local.ts",
    "      body: JSON.stringify(body),\n    });",
    "      body: JSON.stringify(body),\n      signal,\n    });",
)
replace_once(
    "services/connect/src/providers/local-runtime.ts",
    "export function callLocalRuntime(input: LocalRuntimeCallInput): Promise<LocalCallResult> {",
    "export function callLocalRuntime(\n  input: LocalRuntimeCallInput,\n  signal?: AbortSignal,\n): Promise<LocalCallResult> {",
)
replace_once(
    "services/connect/src/providers/local-runtime.ts",
    "      return callLocal(input);",
    "      return callLocal(input, signal);",
)
replace_once(
    "services/connect/src/providers/anthropic.ts",
    "export async function callAnthropic(input: AnthropicCallInput): Promise<AnthropicCallResult> {",
    "export async function callAnthropic(\n  input: AnthropicCallInput,\n  signal?: AbortSignal,\n): Promise<AnthropicCallResult> {",
)
replace_once(
    "services/connect/src/providers/anthropic.ts",
    "      body: JSON.stringify(body),\n    });",
    "      body: JSON.stringify(body),\n      signal,\n    });",
)
replace_once(
    "services/connect/src/providers/openai-compatible.ts",
    "export async function callOpenAiCompatibleHosted(\n  input: OpenAiCompatibleHostedInput,\n): Promise<OpenAiCompatibleHostedResult> {",
    "export async function callOpenAiCompatibleHosted(\n  input: OpenAiCompatibleHostedInput,\n  signal?: AbortSignal,\n): Promise<OpenAiCompatibleHostedResult> {",
)
replace_once(
    "services/connect/src/providers/openai-compatible.ts",
    "      body: JSON.stringify(buildOpenAiCompatibleRequestBody(input)),\n    });",
    "      body: JSON.stringify(buildOpenAiCompatibleRequestBody(input)),\n      signal,\n    });",
)
replace_once(
    "services/connect/src/providers/openai.ts",
    "export function callOpenAi(input: OpenAiCallInput): Promise<OpenAiCompatibleHostedResult> {",
    "export function callOpenAi(\n  input: OpenAiCallInput,\n  signal?: AbortSignal,\n): Promise<OpenAiCompatibleHostedResult> {",
)
replace_once(
    "services/connect/src/providers/openai.ts",
    "    ...adapterInput(input),\n  });",
    "    ...adapterInput(input),\n  }, signal);",
)
replace_once(
    "services/connect/src/providers/openrouter.ts",
    "export function callOpenRouter(\n  input: OpenRouterCallInput,\n): Promise<OpenAiCompatibleHostedResult> {",
    "export function callOpenRouter(\n  input: OpenRouterCallInput,\n  signal?: AbortSignal,\n): Promise<OpenAiCompatibleHostedResult> {",
)
replace_once(
    "services/connect/src/providers/openrouter.ts",
    "    ...adapterInput(input),\n  });",
    "    ...adapterInput(input),\n  }, signal);",
)
replace_once(
    "services/connect/src/providers/hosted.ts",
    "export function callHostedProvider(input: HostedCallInput): Promise<HostedCallResult> {",
    "export function callHostedProvider(\n  input: HostedCallInput,\n  signal?: AbortSignal,\n): Promise<HostedCallResult> {",
)
replace_once(
    "services/connect/src/providers/hosted.ts",
    "      return callAnthropic(adapterInput);",
    "      return callAnthropic(adapterInput, signal);",
)
replace_once(
    "services/connect/src/providers/hosted.ts",
    "      return callOpenRouter(adapterInput);",
    "      return callOpenRouter(adapterInput, signal);",
)
replace_once(
    "services/connect/src/providers/hosted.ts",
    "      return callOpenAi(adapterInput);",
    "      return callOpenAi(adapterInput, signal);",
)
replace_once(
    "services/connect/src/complete.ts",
    "export async function complete(\n  deps: CompleteDeps,\n  input: CompleteInput,\n): Promise<CompleteResult> {",
    "export async function complete(\n  deps: CompleteDeps,\n  input: CompleteInput,\n  signal?: AbortSignal,\n): Promise<CompleteResult> {",
)
replace_once(
    "services/connect/src/complete.ts",
    "      userMessage: input.userMessage,\n    });",
    "      userMessage: input.userMessage,\n    }, signal);",
)
replace_once(
    "services/connect/src/complete.ts",
    "        ...providerInput,\n      });",
    "        ...providerInput,\n      }, signal);",
)

p = Path("services/connect/src/multimodal.ts")
text = p.read_text()
for old, new in [
    (
        "  infer(input: MultimodalInferRequest): Promise<AdapterOutput>;",
        "  infer(input: MultimodalInferRequest, signal?: AbortSignal): Promise<AdapterOutput>;",
    ),
    (
        "  async infer(input: MultimodalInferRequest): Promise<AdapterOutput> {",
        "  async infer(input: MultimodalInferRequest, signal?: AbortSignal): Promise<AdapterOutput> {",
    ),
    (
        "        body: JSON.stringify(input),\n      });",
        "        body: JSON.stringify(input),\n        signal,\n      });",
    ),
    (
        "    const output = await adapter.infer(input);",
        "    const output = await adapter.infer(input, signal);",
    ),
    (
        '  if (input.route.preferred === "hosted") return callRoute(deps, input, "hosted", now);',
        '  if (input.route.preferred === "hosted") return callRoute(deps, input, "hosted", now, signal);',
    ),
    (
        '    return await callRoute(deps, input, "local", now);',
        '    return await callRoute(deps, input, "local", now, signal);',
    ),
    (
        '    return callRoute(deps, input, "hosted", now);',
        '    return callRoute(deps, input, "hosted", now, signal);',
    ),
]:
    if old not in text:
        raise SystemExit(f"missing multimodal marker: {old[:80]!r}")
    text = text.replace(old, new, 1)
# There are two `(deps,input,now)` signatures; add signal to callRoute first, inferMultimodal second.
sig = "  now: Timestamp,\n): Promise<MultimodalAdapterResult> {"
if text.count(sig) != 2:
    raise SystemExit(f"expected two multimodal signatures, got {text.count(sig)}")
text = text.replace(sig, "  now: Timestamp,\n  signal?: AbortSignal,\n): Promise<MultimodalAdapterResult> {", 2)
p.write_text(text)

# Connect HTTP ties incoming connection abort to provider fetches.
p = Path("services/connect/src/http.ts")
text = p.read_text()
text = text.replace(
    '    const body = parseOrBadRequest(CompleteBodySchema, req.body);\n    try {\n      return await complete(deps, body);',
    '    const body = parseOrBadRequest(CompleteBodySchema, req.body);\n    const controller = new AbortController();\n    const abort = (): void => controller.abort();\n    req.raw.once("aborted", abort);\n    try {\n      return await complete(deps, body, controller.signal);',
    1,
)
first_catch = """    } catch (err) {
      throw toHttpError(err);
    }
  });

  app.post("/v1/multimodal/infer""" 
if first_catch not in text:
    raise SystemExit("missing Connect first catch marker")
text = text.replace(
    first_catch,
    """    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  app.post("/v1/multimodal/infer""",
    1,
)
text = text.replace(
    '    const body = parseOrBadRequest(MultimodalInferRequestSchema, req.body);\n    try {',
    '    const body = parseOrBadRequest(MultimodalInferRequestSchema, req.body);\n    const controller = new AbortController();\n    const abort = (): void => controller.abort();\n    req.raw.once("aborted", abort);\n    try {',
    1,
)
text = text.replace(
    "        nowIso(),\n      );",
    "        nowIso(),\n        controller.signal,\n      );",
    1,
)
last_catch = """    } catch (err) {
      throw toHttpError(err);
    }
  });

  return app;"""
if last_catch not in text:
    raise SystemExit("missing Connect final catch marker")
text = text.replace(
    last_catch,
    """    } catch (err) {
      throw toHttpError(err);
    } finally {
      req.raw.off("aborted", abort);
    }
  });

  return app;""",
    1,
)
p.write_text(text)

# Wire voice runtime into Hub.
p = Path("services/hub/src/http.ts")
text = p.read_text()
text = text.replace(
    "  ModuleNameSchema,\n  OperationIdSchema,",
    "  ModuleNameSchema,\n  MultimodalAdapterResultSchema,\n  OperationIdSchema,",
    1,
)
text = text.replace(
    'import { registerMcpRoutes } from "./mcp.js";',
    'import { registerMcpRoutes } from "./mcp.js";\nimport { registerVoiceRoutes } from "./voice-http.js";\nimport { RealtimeVoiceRuntime } from "./voice-runtime.js";\nimport { VoiceSessionStore } from "./voice-store.js";',
    1,
)
marker = """  const deps: OrchestrateDeps = {
    repo,
    history,
    authority,
    contextUrl: options.contextUrl,
    connectUrl: options.connectUrl,
    rndUrl: options.rndUrl,
    internalToken: options.internalToken,
  };
"""
if marker not in text:
    raise SystemExit("missing Hub deps marker")
wiring = marker + """
  const voice = new RealtimeVoiceRuntime({
    store: new VoiceSessionStore(db),
    authority,
    repo,
    history,
    now: nowIso,
    infer: async (input, signal) => {
      try {
        return MultimodalAdapterResultSchema.parse(
          await httpJson(`${options.connectUrl}/v1/multimodal/infer`, {
            token: options.internalToken,
            body: input,
            signal,
          }),
        );
      } catch (err) {
        throw forwardOrUpstreamError("Connect", err);
      }
    },
    chat: async (input, execution) =>
      chat(deps, input, nowIso(), {
        target: execution.target,
        syncClass: execution.syncClass,
        signal: execution.signal,
        sourceApp: "ai:voice",
      }),
  });
  registerVoiceRoutes(app, voice);
"""
text = text.replace(marker, wiring, 1)
p.write_text(text)

# Architecture/operations documentation.
Path("docs/adr/0027-realtime-voice.md").write_text("""# ADR-27 — Realtime Voice

Status: Accepted — Batch 6 implementation

## Context

Batch 5 established normalized STT/TTS through Connect, Hub-owned authority, SyncClass egress checks, cumulative hosted spend guards, Context/History provenance, and explicit local/hosted routing. Realtime voice must add low-latency conversation without creating a second provider gateway, permission plane, memory source, or durability engine.

Persisting every microphone frame into Artifact would create a high-cardinality blob stream that is neither useful memory nor a stable user artifact. Keeping every realtime state only in browser memory would make ordering, audit, reconnect, and fail-closed restart behavior unverifiable.

## Decision

1. Hub owns realtime voice session coordination. Durable SQLite records track lifecycle, generation, monotonic client sequence, language mode, VAD configuration, and append-only event metadata.
2. Audio uplink is chunked `audio/*` with explicit `clientSequence`. Each chunk has an immutable receipt/fingerprint. Exact completed replay is safe; same sequence with different bytes or ambiguous PROCESSING/FAILED receipt fails closed.
3. Browser VAD is the first speech boundary. Hub does not trust it for security: MIME, schema, ordering, capability, SyncClass, Connect routing, credential, kill-switch, and spend controls are re-evaluated server-side.
4. Speech chunks use Batch 5 STT. Normalized language metadata drives `auto` Indonesian/English switching; explicit `id` or `en` pins the language.
5. Final transcript enters the normal Hub chat path, so user/assistant text, Context memory, Historical Ledger, authority, provider accounting, and RnD tracing do not get a voice-specific duplicate implementation. Voice can select the existing local or hosted completion target.
6. Assistant text is delivered downstream incrementally as bounded `assistant.delta` events. The current provider completion contract remains request/response; Batch 6 guarantees realtime incremental downstream delivery, not provider-native first-token streaming.
7. Each text delta is synthesized through Batch 5 TTS and delivered as transient `assistant.audio`. Durable voice events retain only audio metadata; raw live microphone/TTS bytes are not duplicated into the voice event database.
8. Server-Sent Events provide ordered downlink events while chunk POSTs provide uplink. Together they form a duplex application transport without adding a second RPC authority boundary.
9. Barge-in increments a generation counter and aborts the active request chain. Stale generations are never emitted after interruption. AbortSignal propagates Hub → Connect → local/hosted completion and STT/TTS fetches.
10. Open live sessions are not adopted after a Hub process restart. They are marked FAILED with an append-only restart event; clients explicitly start a new live session.
11. Latency events record model latency, first TTS-chunk latency, end-to-end latency, and barge-in count; STT chunk latency is recorded on transcript events. These are telemetry facts, not performance claims.

## Consequences

- Batch 6 reuses security/cost/provider boundaries proven in Batch 4–5.
- Final conversational text remains reconstructable from Historical Ledger/Context without storing raw live audio.
- Reconnect can replay durable transcript/state events; already-delivered transient audio is not guaranteed after process loss.
- Browser playback stops immediately on barge-in while server cancellation prevents stale provider/TTS work where fetch honors AbortSignal.
- Realtime voice does not create a new durable workflow engine; long-running workflow durability remains Flow/Temporal's domain.
""")

Path("docs/voice-operations.md").write_text("""# Realtime Voice Operations — Batch 6

## Boundary

`Ai microphone/VAD -> Hub voice session -> Connect STT -> Hub chat -> Connect model -> Connect TTS -> Hub SSE -> Ai playback`

Hub owns session/order/audit. Connect owns model/STT/TTS runtime and credentials. Context/History keep final conversational semantics/provenance. Raw live audio is transient transport data.

## Endpoints

- `POST /v1/voice/sessions` — create/idempotently reopen same configuration.
- `POST /v1/voice/chunks` — monotonic audio uplink with `clientSequence`.
- `POST /v1/voice/interrupt` — explicit barge-in/cancel.
- `POST /v1/voice/close` — close live session.
- `GET /v1/voice/events?sessionId=...&after=N` — finite event replay/debug view.
- `GET /v1/voice/stream?sessionId=...&after=N` — ordered SSE downlink.

Ai exposes same-origin proxy routes under `/api/voice/*`; `apps/ai/lib/voice-client.ts` provides microphone capture, VAD, PCM16 WAV chunking, SSE handling, and audio playback without defining a second provider contract.

## Lifecycle

Normal path: `LISTENING -> THINKING -> SPEAKING -> LISTENING`. Barge-in passes through `INTERRUPTED`, increments generation, aborts stale work, then returns to `LISTENING`. `CLOSED` and `FAILED` reject new audio chunks.

A Hub restart marks any non-terminal live session `FAILED`: transient audio buffers cannot be truthfully adopted after process loss.

## VAD / chunking

Default client VAD is RMS threshold `0.02`, silence `700 ms`, chunk target `800 ms`. These are adjustable transport parameters, not security controls. Server still validates MIME, body schema, ordering, authority, and routing.

## Language

`languageMode=auto` follows normalized STT language when `id` or `en`; `mixed/unknown` retain current language. Explicit `id`/`en` disables automatic switching. Active language feeds TTS.

## Routing / privacy

Voice uses the existing Batch 5 `route`. STT/TTS can use explicit hosted fallback exactly as Batch 5 permits. Assistant model uses the preferred route directly and does not silently replay a partially-recorded chat turn on another provider. Hosted paths still require cloud-eligible SyncClass, Hub grants, Connect credentials, kill switch, and durable spend reservation.

## Streaming semantics

STT is incremental per audio chunk. Assistant text/audio is streamed from Hub as ordered events. The current Connect chat provider contract produces a completed model reply before Hub slices it into downstream deltas; this baseline does not claim provider-native first-token streaming.

## Replay / failures

- Exact completed audio-chunk replay returns prior ack.
- Same `clientSequence` with different payload → HTTP 409.
- PROCESSING/FAILED replay is ambiguous and fails closed.
- Missing sequence gaps → HTTP 409.
- Stale generations are suppressed after interruption.
- Durable voice events never store `audioBase64`; only in-process live delivery overlays transient bytes.
""")

p = Path("docs/adr/README.md")
text = p.read_text().replace("Dua puluh enam keputusan", "Dua puluh tujuh keputusan", 1)
row26 = "| [26](0026-native-multimodal-pipeline.md) | Native multimodal memakai Artifact/Context/Connect/Hub owner boundaries + explicit hosted fallback |\n"
if row26 not in text:
    raise SystemExit("missing ADR 26 row")
text = text.replace(
    row26,
    row26
    + "| [27](0027-realtime-voice.md) | Realtime voice memakai Hub session/SSE + Batch 5 STT/TTS dengan barge-in generation cancellation |\n",
    1,
)
p.write_text(text)

p = Path("docs/DECISIONS.md")
text = p.read_text()
row = '| 2026-09-10 | Realtime voice dimiliki Hub sebagai live session/order plane; STT/TTS tetap Connect, final transcript/reply tetap lewat chat/Context/History, raw audio live transient, dan barge-in memakai generation + AbortSignal tanpa membuat provider/permission/durability engine kedua | ADR-27, `docs/voice-operations.md` |\n'
if row not in text:
    p.write_text(text + "\n" + row)

p = Path("docs/EXECUTION-PROGRESS.md")
text = p.read_text().replace(
    "## Batch 6 — Realtime Voice\n\nStatus: **PLANNED**",
    "## Batch 6 — Realtime Voice\n\nStatus: **IN PROGRESS**",
    1,
)
p.write_text(text)
