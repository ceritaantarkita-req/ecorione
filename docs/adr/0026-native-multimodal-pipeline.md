# ADR-26 — Native Multimodal Pipeline

Status: Accepted — Batch 5 implementation
Date: 2026-09-10

## Context

ECORIONE already has separate owner boundaries for raw Artifact bytes, Context semantic data, Connect provider/runtime access, and Hub orchestration/authority. Batch 5 must add image, document/PDF, OCR/vision, speech-to-text, transcript timestamps, text-to-speech, lifecycle, and provenance without creating a second media store or bypassing existing security/cost controls.

Sending raw media directly from UI/Hub to provider-specific SDKs would violate the existing architecture: credentials and hosted spend belong to Connect; Artifact is the CAS owner; Context owns extracted semantics; Historical Ledger is the durable provenance log; Hub is the central policy/authority coordinator.

## Decision

1. **Artifact owns raw media bytes.** Images, PDFs/documents, audio, video, and generated TTS audio remain immutable content-addressed Artifacts. Multimodal code references `ArtifactId`; it never persists caller file paths as authority.
2. **Hub owns orchestration and attachment lifecycle.** `RECEIVED → PROCESSING → READY|FAILED` is durable Hub state keyed by `OperationId`. Identical retries return the committed result; a different request using the same operation conflicts. Ambiguous failed/processing operations are not replayed automatically.
3. **Connect owns OCR/vision/STT/TTS adapters and provider egress.** The normalized `/v1/multimodal/infer` boundary supports local and hosted adapters. Provider credentials stay in Connect and hosted usage continues through the cumulative spend guard.
4. **Routing is local-first and deterministic.** Default is local with no fallback. Hosted fallback occurs only when the caller explicitly sets `allowHostedFallback=true`; direct hosted use is also explicit.
5. **Hosted egress is gated twice.** Hub checks the capability/permission plane and `SyncClass` before reading/sending bytes; Connect independently rejects hosted inference unless `maySendToHosted(syncClass)` is true and the cost kill switch permits it.
6. **Context owns derived semantics.** OCR/vision/STT text, language, page number, normalized bounding boxes, confidence, and transcript timestamps are persisted as rebuildable Context derivations, linked to an L0 episode and source Artifact.
7. **Historical Ledger records provenance, not duplicated raw payloads.** `artifact.extracted`, `artifact.transcribed`, and `artifact.synthesized` events record pointers, route/model/adapter identity, and segment counts. Raw media and full extracted text are not duplicated into Ledger payloads.
8. **TTS output returns to Artifact.** Synthesized audio from Connect is uploaded to Artifact using the caller's scope/sensitivity/sync classification, then recorded in the Ledger as an Artifact pointer.
9. **Media body limits are explicit.** The Artifact 20 MiB binary ceiling is reflected in HTTP body limits (including Base64 expansion), and Connect has a bounded 32 MiB multimodal request ceiling.
10. **Realtime conversational voice is not part of Batch 5.** Streaming duplex voice/session transport remains Batch 6. Batch 5 provides file/request-based STT and TTS primitives needed by it.

## Normalized metadata

A multimodal segment can contain:

- `text`
- `page` for document/OCR results
- normalized `boundingBox {x,y,width,height}` in `[0,1]`
- `confidence` in `[0,1]`
- `startMs` / `endMs` for STT
- detected language: `id | en | mixed | unknown`

The adapter result also identifies `routeUsed`, adapter, provider, pinned model identity, actual hosted cost, and counterfactual/naive cost.

## Failure and retry semantics

Multimodal calls can cross multiple owner services and cannot be wrapped in one distributed transaction. Therefore:

- Hub persists lifecycle before downstream work.
- `READY` is replay-safe and returns the stored response.
- `PROCESSING` or `FAILED` is fail-closed for automatic replay; a new `OperationId` is required unless an operator first verifies the prior side effects.
- Context derivation writes are idempotent by `OperationId` and conflict if the payload changes.
- Artifact writes remain CAS-deduplicated.

This chooses duplicate prevention over speculative recovery after an ambiguous network failure.

## Consequences

### Positive

- Existing ownership boundaries remain intact.
- Image/document/audio support does not introduce provider-specific orchestration into Hub.
- Hosted media cannot silently bypass sync classification, authority, credential vault, kill switch, or spend budget.
- OCR page/bbox/confidence and STT timestamps are durable and queryable without bloating Historical Ledger.
- Batch 6 can build realtime voice on stable STT/TTS primitives.

### Costs / limits

- A normalized HTTP adapter implementation must exist for the configured local/hosted media runtime.
- Large media is Base64-encoded between local services in Batch 5; streaming binary transport can be optimized later without changing ownership contracts.
- Ambiguous failed operations require operator inspection/new `OperationId` rather than automatic retry.
- Batch 5 does not claim live duplex audio, interruption/barge-in, or realtime transport.
