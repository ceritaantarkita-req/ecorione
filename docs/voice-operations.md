# Realtime Voice Operations — Batch 6

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

## Validation evidence

- Batch 6 integration run `34422346310`: root typecheck PASS and focused voice regression PASS.
- Strict lint-fix run `34423581218`: lint PASS, root typecheck PASS, focused voice regression PASS, and the temporary helper self-deleted before the candidate head.
- Closure still requires exact-head repository CI, exact-head MCP External HTTPS Acceptance, expected-head merge, and post-merge `main` verification before Batch 6 can be marked `CLOSED`.
