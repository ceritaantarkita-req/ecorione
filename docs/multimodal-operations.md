# Native Multimodal Operations — Batch 5

This document is the operator/developer contract for Batch 5. Architecture rationale is in ADR-26.

## Owner boundaries

| Data / action | Owner |
|---|---|
| raw image, PDF/document, audio, video, generated speech bytes | Artifact |
| OCR/vision/STT text + page/bbox/confidence/timestamps/language | Context |
| local/hosted media adapters, provider credential, hosted spend | Connect |
| routing, authority, attachment lifecycle | Hub |
| durable provenance | Historical Ledger (Hub) |

Do not copy raw media into Hub/Context tables and do not call provider media endpoints outside Connect.

## Hub API

### Analyze an Artifact

`POST /v1/multimodal/analyze`

```json
{
  "operationId": "op_example001",
  "sessionId": "sess_example001",
  "workspaceId": "ws_personal",
  "artifactId": "art_example001",
  "scope": "personal",
  "maxSensitivity": "INTERNAL",
  "task": "ocr",
  "route": {
    "preferred": "local",
    "allowHostedFallback": false
  }
}
```

`task` is `ocr`, `vision`, or `transcribe`.

Accepted media families:

- OCR / vision: `image/*`, PDF, DOC/DOCX, ODT, `text/*`
- transcription: `audio/*`, `video/*`

The source Artifact is authorized by Context before bytes are read. Hub uses the Artifact's persisted classification, not caller-supplied MIME/classification metadata.

A successful response includes the normalized result, Context episode ID, and Historical Ledger event ID. OCR/document segments can include page, normalized bounding box, confidence, and language. STT segments can include `startMs` / `endMs`.

### Synthesize speech

`POST /v1/multimodal/synthesize`

```json
{
  "operationId": "op_tts001",
  "sessionId": "sess_tts001",
  "workspaceId": "ws_personal",
  "scope": "personal",
  "sensitivity": "INTERNAL",
  "syncClass": "LOCAL_ONLY",
  "text": "Halo dunia",
  "language": "id",
  "voice": "optional-adapter-voice-id",
  "description": "Generated speech",
  "route": {
    "preferred": "local",
    "allowHostedFallback": false
  }
}
```

The normalized adapter must return `audioBase64` plus an `audio/*` MIME. Hub immediately writes the bytes to Artifact and returns the resulting pointer. Audio bytes are not returned again in the Hub response.

### Lifecycle status

`GET /v1/multimodal/:operationId`

States:

- `RECEIVED`
- `PROCESSING`
- `READY`
- `FAILED`

A `READY` request is replay-safe and returns the stored result when the same payload is retried. `PROCESSING`/`FAILED` are not automatically replayed because downstream side effects may be ambiguous after a network/process failure. Inspect status/provenance and use a new `OperationId` for a deliberate retry.

## Routing and hosted fallback

Default:

```json
{ "preferred": "local", "allowHostedFallback": false }
```

There is no automatic provider/model quality router.

Hosted execution is possible only when all of the following are true:

1. the request explicitly selects hosted or enables hosted fallback;
2. Hub capability authority grants the required model/network/spend permissions;
3. source/input `syncClass` is `CLOUD_ALLOWED` or `PUBLIC`;
4. Connect cost kill switch is not active;
5. the hosted adapter is configured;
6. hosted credential is available from the Connect vault (or local-dev provider key fallback when no vault is active);
7. cumulative spend reservation succeeds when spend budgets are enabled.

For a local-first request with hosted fallback enabled, Hub pre-authorizes both possible routes before media bytes are read. This intentionally fails closed rather than discovering missing hosted authority only after local failure.

## Connect adapter protocol

Set:

```text
ECORIONE_MULTIMODAL_LOCAL_URL=http://127.0.0.1:PORT/infer
ECORIONE_MULTIMODAL_HOSTED_URL=https://gateway.example/infer
ECORIONE_MULTIMODAL_HOSTED_RESERVATION_USD=1
```

The local adapter needs no provider credential. The hosted HTTP adapter always obtains the selected hosted provider's `messages` credential from Connect's credential reader; production credentials therefore stay rotatable in the existing vault.

Connect posts the normalized inference request to the configured adapter endpoint. Analyze requests contain:

```json
{
  "operationId": "op_example001",
  "task": "ocr",
  "route": { "preferred": "local", "allowHostedFallback": false },
  "syncClass": "LOCAL_ONLY",
  "mimeType": "image/png",
  "contentBase64": "..."
}
```

TTS requests contain `text`, `language`, and optional `voice` instead of media bytes.

The adapter response contract is:

```json
{
  "adapter": "adapter-build-v1",
  "provider": "local-or-provider-id",
  "model": "pinned-model-identity",
  "language": "id",
  "text": "extracted/transcribed text",
  "segments": [
    {
      "text": "segment",
      "page": 1,
      "boundingBox": { "x": 0.1, "y": 0.2, "width": 0.5, "height": 0.1 },
      "confidence": 0.98,
      "startMs": 0,
      "endMs": 1200,
      "language": "id"
    }
  ],
  "actualUsd": 0,
  "naiveUsd": 0
}
```

For TTS, add:

```json
{
  "audioBase64": "...",
  "audioMimeType": "audio/wav"
}
```

Rules:

- `boundingBox` uses normalized `[0,1]` coordinates.
- `confidence` is `[0,1]`.
- `endMs >= startMs`.
- language is `id`, `en`, `mixed`, or `unknown` (`synthesize` input is `id` or `en`).
- local adapters must report `actualUsd=0` and `naiveUsd=0`.
- model identities containing `latest` are rejected.
- hosted adapters must report actual/counterfactual cost honestly; the durable spend reservation remains conservative if settlement cannot be persisted after provider success.

## Persistence and provenance

For analyze operations:

1. Artifact authorizes and serves raw bytes.
2. Connect returns normalized semantic output.
3. Context receives an L0 episode linked to `artifact:<ArtifactId>`.
4. Context persists the full derivation metadata keyed by `OperationId`.
5. Historical Ledger appends `artifact.extracted` or `artifact.transcribed` with pointers/model/route metadata only.
6. Hub marks lifecycle `READY` and persists the response receipt.

For TTS:

1. Connect synthesizes audio.
2. Hub uploads generated bytes to Artifact with the input classification.
3. Historical Ledger appends `artifact.synthesized` pointing to the output Artifact.
4. Hub marks lifecycle `READY`.

## Size limits

Artifact keeps the existing 20 MiB decoded binary ceiling. HTTP boundaries account for Base64 expansion:

- Artifact request body: derived from configured `maxBytes`, approximately `4/3` plus bounded metadata room.
- Connect multimodal request body: 32 MiB by default.

This is intentionally bounded. Batch 5 does not introduce unbounded streaming uploads.

## Batch boundary

Batch 5 includes file/request-based OCR, vision, STT, timestamped transcript metadata, and TTS primitives. It does **not** claim realtime duplex voice sessions, audio streaming transport, interruption/barge-in, or live call state. Those belong to Batch 6.
