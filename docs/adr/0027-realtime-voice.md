# ADR-27 — Realtime Voice

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
