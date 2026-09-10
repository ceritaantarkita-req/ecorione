# Local production rehearsal — 2026-09-10

Status: **REAL LOCAL EVIDENCE / not a VPS-production claim**

This note records a real post-closure Production Activation rehearsal on a Windows 11 laptop with Ubuntu 24.04 under WSL2. It intentionally excludes usernames, hostnames, secrets, local file paths and provider credentials.

## Environment exercised

- Docker Desktop 4.86.0 / Docker Engine 29.7.2
- Docker Compose 5.3.1
- Node.js 22.23.2
- pnpm 10.28.0
- Ollama 0.33.3 on Windows
- WSL2 mirrored networking for Windows↔Linux loopback interoperability

The repository was cloned fresh into the Linux filesystem. `pnpm install --frozen-lockfile` and `pnpm verify` completed successfully before runtime testing. The verification run reported 102 test files, 530 passed tests, 2 skipped tests, clean secret scan and a successful Next.js production build.

## Runtime checkpoints

The staged local runtime was exercised rather than inferred from CI:

1. baseline `pnpm dev`: RnD `17021`, Context `17022`, Connect `17023`, Hub `17024`, Ai `3000`;
2. `pnpm dev:phase3`: Artifact `17025`, Sandbox `17026`, Space `17027` added;
3. `pnpm dev:phase4`: Flow `17028` plus Temporal worker added;
4. `/healthz` returned `status: ok` for services `17021` through `17028`;
5. Temporal worker reached state `RUNNING` on task queue `ecorione-flow-v1`.

## Temporal defect found by the rehearsal

The repository had pinned `temporalio/auto-setup:1.31.2`. A real Docker pull failed because that tag was not available, so the container could not be created. `temporalio/auto-setup:1.29.7` was then pulled successfully and ran with PostgreSQL `17.6-alpine`; port `127.0.0.1:7233` became reachable and the ECORIONE Flow worker reached `RUNNING`.

The Production Activation candidate therefore changes the exact Compose pin and acceptance assertion to `1.29.7`. This is a concrete runtime correction discovered by local evidence, not a CI-only assumption.

## Local provider evidence

Ollama exposed its OpenAI-compatible API on Windows loopback. Under default WSL NAT, Windows loopback was not reachable from the WSL process. WSL2 mirrored networking made `127.0.0.1:11434` reachable from both sides while allowing Ollama to remain loopback-bound instead of listening broadly on `0.0.0.0`.

The local ECORIONE runtime used:

- runtime protocol: `openai-compatible`;
- base URL: `http://127.0.0.1:11434/v1`;
- rehearsal runtime model: `gemma4:latest`;
- hosted-call kill switch: enabled.

The direct Connect provider canary returned:

- `pass: true`;
- `target: local`;
- `provider: local`;
- `responseModel: gemma4:latest`;
- latency approximately `4430.5 ms`;
- input tokens `41`, output tokens `164`;
- provider-token `actualUsd: 0`;
- route reason `local-consolidation`.

`gemma4:latest` is accepted only as rehearsal evidence. A mutable `:latest` alias is not a durable production model identity; production evidence must use an immutable local tag/alias selected by the operator.

## Defects fixed from the evidence

The rehearsal exposed two additional correctness gaps:

1. local `model`/telemetry/cache identity was hard-coded to a Qwen pricing identity even when the configured runtime was Gemma;
2. the Ai chat surface did not carry an explicit local/hosted target, so browser chat defaulted to hosted and was correctly rejected by the hosted cost kill switch.

The candidate fixes these without changing provider ownership:

- Connect reports actual requested runtime `model`, separate `responseModel`, and separate generic zero-provider-token `pricingModel`;
- the legacy Qwen pricing key is retained for Historical Ledger/replay compatibility;
- local exact-cache keys include runtime type, base URL and configured model so changing local models cannot reuse stale results from a different runtime identity;
- Ai can explicitly select Local or Hosted, defaulting the UI to Local; the choice is locked after the first turn so a single Historical Ledger session does not silently cross `LOCAL_ONLY`/`CLOUD_ALLOWED` boundaries;
- requests that omit `target` retain the historical hosted default for API compatibility.

## 2026-09-11 post-merge local verification finding

After the Production Activation merge was synchronized back to the laptop, the operator loaded the machine-local `.env` into the shell and ran `pnpm verify`. Formatting, lint and typecheck passed, and 102 test files passed, but one Ai proxy test failed because the test process inherited the real `ECORIONE_INTERNAL_TOKEN` from the shell. The failing assertion expected the no-token case to omit `Authorization`, while the test fixture had not cleared the ambient token before that case.

This is a **test isolation defect**, not evidence that the production proxy is dropping or inventing authentication. The production behavior is correct: when a token exists, the proxy forwards `Authorization: Bearer <token>`. The regression fix makes `apps/ai/lib/proxy.test.ts` establish a token-empty baseline in `beforeEach`, while the explicit bearer-auth test continues to set its own test token. `afterEach` restores the operator's original environment value, so running tests must not mutate the caller's shell configuration.

The purpose of the fix is to make `pnpm verify` deterministic both in clean CI and on a development machine where `.env` was sourced for a running local stack.

## 2026-09-11 secret-scan commit-boundary finding

After the proxy isolation fix was merged and pulled, the same sourced-runtime verification reached 103 passing test files with 537 passing tests and 2 skipped tests. It then failed only at `secret-scan` because the scanner walked the entire working tree and treated the intentionally gitignored machine-local `.env` as though it were a commit candidate.

That behavior conflicted with the repository's own local-state rule: `.env` is required for local runtime configuration and is intentionally excluded by Git. The correction makes the scanner inspect Git commit candidates instead: tracked files plus untracked files that are not ignored. This does **not** permit credential files into source control: a forbidden `.env` that is already tracked or force-added remains visible through Git's cached file set and is rejected, while non-ignored untracked files are still scanned for credential patterns. If Git metadata is unavailable, the scanner falls back fail-closed to the full working tree.

Focused regression tests cover all three boundaries: ignored local `.env` passes, force-added `.env` fails, and a non-ignored untracked secret fails.

## Evidence boundary

This rehearsal proves local process health, local Temporal/Flow interoperability and a real local model call through the Connect boundary. It does **not** prove VPS durability, Cloudflare named-Tunnel operation, hosted-provider quality, public production latency or disaster recovery.

The canary's `naiveUsd`/`savedUsd` values are counterfactual accounting against the configured naive hosted baseline. A single local canary is not sufficient evidence for a public ECX/optimizer savings claim.

## Local/Git synchronization rule

Git-tracked code and documentation should be synchronized from the merged GitHub `main`. Local runtime state is intentionally different and must remain untracked:

- `.env` and `.env.*` are gitignored;
- credentials, database files, Ollama model blobs, Docker volumes and WSL/Windows settings are machine-local;
- only sanitized evidence and reusable configuration/runbook changes belong in Git.

After a candidate merges, the laptop should `git pull --ff-only origin main` and verify `git rev-parse HEAD` equals `origin/main` with a clean tracked working tree before resuming the runtime.
