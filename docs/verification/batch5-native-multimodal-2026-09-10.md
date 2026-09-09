# Batch 5 Native Multimodal — Implementation Verification

Date: 2026-09-10
Status: implementation candidate verified; merge/post-merge closure still required
PR: #15

## Implemented boundaries

- Artifact remains owner of raw image, PDF/document, audio/video, and generated TTS bytes.
- Context owns OCR/vision/STT derived semantics and normalized page/bounding-box/confidence/timestamp/language metadata.
- Connect owns local/hosted OCR/vision/STT/TTS adapters, provider credentials, hosted eligibility re-checks, kill switch, and spend reservation.
- Hub owns capability authorization, routing, durable attachment lifecycle, idempotency, and orchestration.
- Historical Ledger records pointer-first extraction/transcription/synthesis provenance without duplicating raw media.

## Regression coverage

The repository test suite covers:

- local-first inference and explicit hosted fallback only;
- `LOCAL_ONLY` rejection before hosted media dispatch;
- hosted cost kill switch;
- TTS normalization and audio Artifact output;
- OCR page/bounding-box/confidence persistence in Context;
- Context derivation idempotency and conflict detection;
- Hub OCR end-to-end choreography and Historical Ledger provenance;
- Hub TTS end-to-end choreography;
- replay-safe READY result and HTTP 409 for mutated reuse of an `OperationId`.

## Bugs/hardening resolved

- Artifact's decoded 20 MiB limit is now reachable through an explicit Fastify body ceiling that accounts for Base64 expansion.
- Multimodal operation fingerprint conflicts map to HTTP 409 rather than an internal 500.
- Local adapters cannot report hosted spend.
- Hosted HTTP adapters require Connect-owned credential access.
- Adapter model identities containing `latest` are rejected.
- Temporary formatting/progress helper workflows were removed from the branch before final verification.

## Green implementation evidence before tracker update

Candidate SHA: `66644a059d464b37af98894bdf3353b3e0e8a1a2`

- CI `34387285455`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Secret Scan, and Production Build PASS.
- MCP External HTTPS Acceptance `34387285379`: PASS.

The canonical tracker was then updated to `IMPLEMENTED / CLOSURE PENDING`. This verification document creates a normal repository commit after the one-shot bot tracker update so the final PR head can receive ordinary exact-head checks before merge.

Batch 5 must not be marked `CLOSED` until PR #15 is merged with expected-head protection and post-merge `main` verification is green; final closure evidence is recorded in a separate closure update.
