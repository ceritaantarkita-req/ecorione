# Local production rehearsal — 2026-09-10

Status: **REAL LOCAL EVIDENCE PASS / local runtime + Ledger/ECX boundary closed / not a VPS-production claim**

This note records a real post-closure Production Activation rehearsal on a Windows 11 laptop with Ubuntu 24.04 under WSL2, followed by the real Historical Ledger + ECX local evidence checkpoint on 2026-09-11. It intentionally excludes usernames, hostnames, secrets, local file paths and provider credentials.

## Environment exercised

- Docker Desktop 4.86.0 / Docker Engine 29.7.2
- Docker Compose 5.3.1
- Node.js 22.23.2
- pnpm 10.28.0
- Ollama 0.33.3 on Windows
- WSL2 mirrored networking for Windows↔Linux loopback interoperability

The repository was cloned fresh into the Linux filesystem. The synchronized sourced-env verification completed successfully with 104/104 test files, 540 passed tests, 2 skipped tests, a clean secret scan and a successful Next.js production build.

## Runtime checkpoints

The staged local runtime was exercised rather than inferred from CI:

1. baseline `pnpm dev`: RnD `17021`, Context `17022`, Connect `17023`, Hub `17024`, Ai `3000`;
2. `pnpm dev:phase3`: Artifact `17025`, Sandbox `17026`, Space `17027` added;
3. `pnpm dev:phase4`: Flow `17028` plus Temporal worker added;
4. `/healthz` returned `status: ok` for services `17021` through `17028`;
5. Temporal worker reached state `RUNNING` on task queue `ecorione-flow-v1`.

## Temporal defect found by the rehearsal

The repository had pinned `temporalio/auto-setup:1.31.2`. A real Docker pull failed because that tag was not available, so the container could not be created. `temporalio/auto-setup:1.29.7` was then pulled successfully and ran with PostgreSQL `17.6-alpine`; port `127.0.0.1:7233` became reachable and the ECORIONE Flow worker reached `RUNNING`.

Production Activation therefore changed the exact Compose pin and acceptance assertion to `1.29.7`. This is a concrete runtime correction discovered by local evidence, not a CI-only assumption.

## Local provider evidence

Ollama exposed its OpenAI-compatible API on Windows loopback. Under default WSL NAT, Windows loopback was not reachable from the WSL process. WSL2 mirrored networking made `127.0.0.1:11434` reachable from both sides while allowing Ollama to remain loopback-bound instead of listening broadly on `0.0.0.0`.

The local ECORIONE runtime used:

- runtime protocol: `openai-compatible`;
- base URL: `http://127.0.0.1:11434/v1`;
- rehearsal runtime model: `gemma4:latest`;
- hosted-call kill switch: enabled.

The first direct Connect provider canary returned `pass: true`, `target: local`, `provider: local`, `responseModel: gemma4:latest`, latency approximately `4430.5 ms`, provider-token `actualUsd: 0`, and route reason `local-consolidation`.

After the model-identity correction was merged and synchronized, a repeat canary on the final local runtime reported:

- `pass: true`;
- `target: local`;
- `provider: local`;
- `model: gemma4:latest`;
- `responseModel: gemma4:latest`;
- `pricingModel: local/provider-token-zero`;
- latency approximately `22795.9 ms`;
- provider-token cost remained zero.

The latency difference is recorded as observed local-run variance, not yet classified as a product defect. `gemma4:latest` is accepted only as rehearsal evidence. A mutable `:latest` alias is not a durable production model identity; production evidence must use an immutable local tag/alias selected by the operator.

## Ai API and browser Local-chat evidence

The merged Ai server rendered the new `Route` control and a direct `POST /api/chat` with `target: local` completed through the real stack. The response reported `model: gemma4:latest`, `actualUsd: 0`, `cacheHit: false`, and `routeReason: local-consolidation`.

The browser initially displayed an older client bundle and omitted the route selector even though the server HTML already contained it. A hard refresh loaded the current client. This was treated as a browser-cache/stale-bundle condition, not a repository runtime defect.

With the refreshed UI:

- `Route` displayed `Local` before the first turn;
- the route selector locked after the first turn as designed;
- a real browser chat request completed successfully;
- the assistant returned a response through the local stack;
- the UI displayed `Model: gemma4:latest`, `cache miss`, `$0.0000`, and the counterfactual hosted-baseline savings display.

This verifies the local browser path:

`Browser Ai UI → /api/chat → Hub → Connect → Ollama OpenAI-compatible endpoint → gemma4:latest`.

The displayed savings value is counterfactual accounting against the configured naive hosted baseline. It is not, by itself, evidence for a public ECX/optimizer savings claim.

## Session hydration identity finding

While inspecting the real browser traffic in Historical Ledger, the session ID displayed by the pre-fix browser header did not exist in the Ledger even though the successful turn did. The root cause was that a random session ID could be generated independently during server render and client hydration while `suppressHydrationWarning` masked the mismatch.

PR #36 corrected the browser session identity by keeping the random ID client-owned, rendering `sess_pending` on the deterministic server/pre-hydration snapshot, revealing the actual client session only after hydration, and using that same session value for the header and `/api/chat`. Regression coverage verifies server-rendered HTML does not emit a random `sess_<uuid>` before hydration.

Post-fix real evidence showed the browser-visible session `sess_866a9ae3-09f8-4f42-862a-a28cabd9d1f7` resolved directly in Historical Ledger. The exact session contained the Local Gemma turn and no identifier translation was required. Post-merge CI `34551995621` passed all repository gates.

## Historical Ledger + ECX real local evidence

The post-fix browser session produced an intact hash-chained sequence:

1. `seq=0` `user.message` with target `local`;
2. `seq=1` `model.called` with provider `local`, `requestModel=gemma4:latest`, `responseModel=gemma4:latest`, `pricingModel=local/provider-token-zero`, `actualUsd=0`, 210 input tokens and 350 output tokens;
3. `seq=2` `agent.message`.

A real ECX plan then referenced that exact Ledger range (`afterSeq=-1`, `throughSeq=2`) with a 16,384-byte hydration budget. From two candidates, the planner selected the exact `history` + `verification` capability match and returned one 478-byte pointer-first packet.

The packet was hydrated locally with `hostedEligible=false`, preserving the source session's `LOCAL_ONLY` boundary. Hydration returned one `application/json` history item totaling 1,725 bytes.

The plan also appended `seq=3` `agent.handoff` with actor `hub:exchange` to the same Ledger session. Its `prevHash` matched the `seq=2` assistant-event hash, extending the existing chain without a gap.

After this real plan/hydration, `pnpm production:data-evidence` returned:

- Historical Ledger: 8 sessions / 15 events;
- ECX: 1 plan / 1 packet / 478 packet bytes / 1 hydration / 1 hydrated item / 1,725 hydration bytes;
- provider traffic: 1 model call / 210 input tokens / 350 output tokens / 0 cache-read / 0 cache-write tokens / USD 0 provider-token actual cost;
- final result: `PASS production-data-evidence: real traffic exists across Historical Ledger, ECX, and provider telemetry boundaries`.

Detailed sanitized evidence is recorded in `docs/verification/historical-ledger-ecx-local-evidence-2026-09-11.md`.

## Defects fixed from the evidence

The rehearsal and immediate Ledger/ECX checkpoint exposed four runtime/correctness gaps and two local-verification isolation gaps:

1. local `model`/telemetry/cache identity was hard-coded to a Qwen pricing identity even when the configured runtime was Gemma;
2. the Ai chat surface did not carry an explicit local/hosted target, so browser chat defaulted to hosted and was correctly rejected by the hosted cost kill switch;
3. the Temporal production image pin referenced an unavailable tag;
4. the Ai header/session could diverge across server render and client hydration, making the displayed session ID differ from the one actually sent to Hub;
5. an Ai proxy test inherited the operator's sourced `ECORIONE_INTERNAL_TOKEN` instead of establishing its own isolated baseline;
6. `secret-scan` walked the whole working tree and rejected an intentionally gitignored machine-local `.env` even though it was not a commit candidate.

The merged corrections preserve the existing ownership boundaries:

- Connect reports actual requested runtime `model`, separate `responseModel`, and separate generic zero-provider-token `pricingModel`;
- the legacy Qwen pricing key remains only for Historical Ledger/replay compatibility;
- local exact-cache keys include runtime type, base URL and configured model;
- Ai explicitly selects Local or Hosted, defaults the browser UI to Local, and locks the route after the first turn;
- Ai displays only the client-owned post-hydration session ID and uses that exact value in `/api/chat`;
- requests that omit `target` retain the historical hosted default for API compatibility;
- Temporal Compose uses the pull/run-verified `1.29.7` image;
- proxy tests isolate ambient environment state and restore the caller's value;
- secret scanning follows Git commit candidates while remaining fail-closed for tracked/force-added credential files and non-ignored untracked secrets.

## Final local/Git synchronization checkpoint

After the local-verification and browser-session fixes were merged, the laptop fast-forwarded to GitHub `main` and verified:

- local `HEAD` equals `origin/main`;
- `git diff --exit-code HEAD origin/main` succeeds;
- tracked working tree is clean;
- machine-local `.env` remains untracked and intact.

The full sourced-env verification before the final data-evidence run reported:

- 104 test files passed;
- 540 tests passed;
- 2 tests skipped;
- `secret-scan: bersih`;
- Next.js production build compiled and generated all expected routes successfully.

## Evidence boundary

The completed local evidence proves:

- local process health and local Temporal/Flow interoperability;
- a real local model call through Connect;
- direct Ai API routing and a real browser Local-chat turn;
- browser-visible session identity matching the actual Historical Ledger session;
- real Ledger chronology and hash-chain continuation through an ECX `agent.handoff`;
- a real pointer-first ECX plan and bounded local-only history hydration;
- observable real model/token/cache/cost traffic sufficient for the `production:data-evidence` floor.

It does **not** prove VPS durability, Cloudflare named-Tunnel operation, hosted-provider quality, public production latency, disaster recovery, ECX/optimizer savings, or execution of a second model/agent from the selected ECX packet.

The local Historical Ledger + ECX evidence checkpoint is therefore **CLOSED**. The next operational checkpoint is deployment and validation on a real compute host/VPS/server.

## Local/Git synchronization rule

Git-tracked code and documentation should be synchronized from the merged GitHub `main`. Local runtime state is intentionally different and must remain untracked:

- `.env` and `.env.*` are gitignored;
- credentials, database files, Ollama model blobs, Docker volumes and WSL/Windows settings are machine-local;
- only sanitized evidence and reusable configuration/runbook changes belong in Git.

After a candidate merges, the laptop should `git pull --ff-only origin main` and verify `git rev-parse HEAD` equals `origin/main` with a clean tracked working tree before resuming the runtime.
