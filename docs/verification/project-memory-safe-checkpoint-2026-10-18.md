# Project Memory — safe checkpoint, 18 October 2026

Status: **SAFE CHECKPOINT / ACCEPTANCE INCOMPLETE / PR #467 DRAFT**.
Branch: `fix/context-automatic-consolidation-20261014`.
Runtime/source baseline: `3d56b41ad580277da30cb86a63e3e3f05fa2ef1c`.

The operator requested a safe checkpoint and a GitHub update. This record preserves
the unfinished acceptance work; it does not replace the
[16 October original-UI failures and 17 October repository patch](project-memory-ui-acceptance-2026-10-16.md).
No merge, deployment, paid provider call, database reset or restore was performed.

## Repository and data safety

- Local worktree was clean at intake and fast-forwarded from `1fc0be9b` to the
  requested GitHub head `3d56b41`. No uncommitted user changes were overwritten.
- SQLite online backups were created on 17 October and again on 18 October for
  Context, Hub, RnD, Space and Temporal. All five backups passed `integrity_check`.
- The final read-only audit found all five live databases healthy and every table's
  logical contents equal to its 18 October backup. No user database was replaced.
- The harmless UI Project `QA-Memory-Acceptance-20261017` was created and retained.
  Its submitted Qwen chat was interrupted before an episode or L1 fact was saved.
- Raw logs, model outputs, configuration copies and database backups remain ignored
  under `data/`; they are not included in the commit.
- At checkpoint, process inspection found no active ECORIONE engine, acceptance
  harness or Ollama server. Resuming requires checking current state before starting
  anything; an existing active engine must not be restarted without approval.

Private preservation pointers:

- `data/memory-20261018-backup-path.txt` identifies the latest backup directory;
- `data/memory-20261018-checkpoint-db-audit.json` records the final integrity and
  logical-content comparisons;
- the spend ledger matched its 17 October backup at checkpoint.

## Measured runtime findings and incomplete runs

Ollama 0.40.5 on the RTX 3060 Laptop GPU stalled during Vulkan discovery. Its log
reported a GPU-discovery watchdog timeout after approximately 90 seconds, then CUDA
became ready. A separate diagnostic instance with `OLLAMA_VULKAN=false` reached CUDA
readiness in approximately five seconds. This is evidence of startup delay, not proof
that the separate 60-second memory-extraction failure is repaired. Only process
environment overrides were used; no persistent machine setting was changed.

One backend attempt timed out fetching Ollama's model inventory before any model
completion. Later runs printed the pinned Qwen and Hermes identities but were
interrupted during the initial Qwen request and produced no acceptance verdict.
Those runs are **INCOMPLETE**, not a passing extraction or a new measured extraction
timeout. The observed model context was 4,096 tokens; one load offloaded 19/34 layers
to GPU. No hardware-wide performance guarantee follows from these observations.

Original UI access was subsequently denied by the browser URL policy. No alternate
browser route was used to bypass it. The operator explicitly chose **backend work
first**. Fresh original-UI acceptance remains blocked until browser access is restored.

Private evidence: `memory-20261017-model-baseline.log`,
`memory-20261017-ollama-error.log`, `memory-20261017-ollama-probe-error.log`,
`memory-20261017-model-recheck.log`, `memory-20261017-isolated-model.log`,
`memory-20261018-model.log` and `memory-20261018-ollama-error.log` under `data/`.

## Prepared acceptance checks

The existing opt-in `scripts/project-memory-local-acceptance.mjs` now requires:

- exactly three separate facts with the literal expected object values;
- case-sensitive literal recall, including a fresh Hermes paraphrase session;
- explicit per-message CLOUD_ALLOWED input isolation, positive eligible retrieval
  and unchanged pre-existing LOCAL_ONLY facts, without hosted inference.

Existing isolated-process persistence, sibling Project isolation, provenance and
failed-extraction retry checks remain. Cloud consent runs after Hermes recall so its
extra test fact cannot displace the three recall targets from the bounded fallback.
These added assertions are **prepared but not yet verified by a complete real-model
run**. Syntax, ESLint and formatting checks passed. No production behavior was
changed by this checkpoint.

## Verification actually completed

- Full local regression at the runtime baseline: **1,630 passed, 4 failed, 4 skipped**
  across 309 files (306 passed, 2 failed, 1 skipped). All four failures are the
  previously reproduced POSIX `0600` assertions in the two off-host DR files on
  Windows. Both Temporal cases passed in this run. No gate was weakened.
- Typecheck, ESLint and isolated production build passed. Repository formatting,
  secret scan and dependency review (17 manifests) passed.
- All six GitHub checks passed for `3d56b41`: CI verify, naming, secret-history,
  Product Eval, MCP HTTPS and PCS-06 Browser. This certifies the repository baseline,
  not real Qwen/Hermes acceptance. The PR records checks for the checkpoint commit
  separately after publication.

Private logs: `memory-20261017-regression.log`, `memory-20261017-typecheck.log`,
`memory-20261017-lint.log`, `memory-20261017-build.log` and
`memory-20261017-format.log`.

## Resume safely

1. Audit local changes and the exact PR head; inspect service/model processes and
   verify SQLite backups before further writes. Never overwrite local work or data.
2. Ensure one responsive local Ollama instance with the installed pinned models.
   If startup discovery hangs, use the measured CUDA-only process setting rather
   than counting the inventory timeout as a memory failure. Do not stop user-owned
   services or restart the active engine without approval.
3. Run the strengthened isolated harness with hosted kill switch enabled, 768 output
   tokens, temperature zero and reasoning disabled:
   `node --import tsx scripts/project-memory-local-acceptance.mjs qwen3.5:9b hermes3:latest`.
   Record extraction duration/prompt bytes, all three literal facts and actual recall
   results. Profile any failure before changing deadlines or model behavior.
4. Restore authorized browser access, then repeat the actual UI three-fact Qwen
   extraction, fresh-session Hermes direct/paraphrase recall and policy/isolation
   checks. Synthetic/backend success alone cannot close this gate.
5. Recheck persistence and exact-head repository gates after any runtime repair.
   Keep PR #467 draft until the remaining acceptance failures are truly resolved;
   merge and deployment require the operator's separate approval.

## Follow-up GitHub integrity patch — 18 October (repository-only)

This section is newer than the **safe checkpoint** recorded above and does not
rewrite the historical local evidence.

- The Context consolidation pipeline now requires the **literal value** of
  date/deadline, code/identifier, and owner/responsible-person claims to appear
  in the authoritative USER source episode before promotion. Date-shaped
  values and hyphenated reference codes are guarded even with generic model
  predicates. Matches are case-sensitive and use word boundaries, preventing
  a truncated code from being accepted as a substring.
- A mismatch returns only the stable `SOURCE_LITERAL_MISMATCH` diagnostic:
  no source text/model output is logged, the invalid claim is not promoted,
  and the episode remains pending for retry. Previously stored supported
  facts remain intact. The Projects UI explains the failure without disclosing
  private content.
- Unit regressions cover a three-claim retry with a fabricated deadline,
  unsupported owner/code values, and generic-predicate/partial-code attempts.
  Earlier unrelated source/provenance, policy-class and privacy gates remain.
- This safeguards **storage correctness**, not the separate local-Qwen
  inference deadline or Hermes answer correctness. No new real local model,
  original UI, SQLite database, deployment, or paid-hosted call was performed
  as part of this GitHub-only patch.

**Acceptance remains INCOMPLETE / PR #467 DRAFT.** CI on the final patch head
must be checked separately; exact-Qwen/Hermes proof is still required.


## GitHub-only extraction control tuning — 18 October 2026

This section documents repository-side changes made after the safe local
checkpoint and literal-source integrity hardening. It does **not** replace the
operator's original UI or Qwen/Hermes evidence.

- Context tags only its local fact-consolidation completion with
  `localTask: "memory-extraction"`. Connect rejects this task on hosted
  requests and propagates it through its existing local routing, cost,
  identity and cancellation boundaries. Normal local chat is unaffected.
- The local extraction task explicitly requests bounded 768-token output,
  temperature zero and no extended reasoning. The native Ollama adapter
  additionally requests `format: "json"` and `think: false`; its existing
  normal-chat contract remains unchanged. The OpenAI-compatible adapter
  uses its available local generation control fields without claiming native
  Ollama JSON guarantees.
- Exact-cache identity now distinguishes extraction tasks from normal chat
  so replies cannot cross those generation-control boundaries.
- Mock HTTP/provider tests verify the full Connect-to-Ollama task path,
  the hosted rejection, native JSON framing and unchanged ordinary-chat
  baseline. CI success is **not** a measured inference latency.
- The **existing** 60-second Context extraction deadline remains enforced.
  Qwen initialization delays, longer batched source histories and real
  Hermes paraphrase fidelity still require operator-controlled model QA.
  In particular, the 768-token task budget should be evaluated with
  multi-episode backlog; truncated JSON remains retryable, not accepted.

No GPU or live SQLite database was accessed from this GitHub-only patch.
No paid model API, deployment, database reset, or merge was performed.
The PR is still **DRAFT / NOT READY TO MERGE** until authorized real-local
Qwen/Hermes and original-UI acceptance pass.


## 19 October — cloud-only handoff and new-attempt identity

The operator reported that repeated Codex/Desktop GPU runs caused the laptop to
shut down. **Do not attempt further heavy local acceptance on that machine.**
This is not proof of a software/model PASS or FAIL; the observed runs were
interrupted before returning a complete verdict.

A GitHub-hosted **CPU** smoke experiment with smaller Qwen/Hermes variants was
attempted, but its model workflow did not produce a verifiable run or a model
verdict. All temporary workflow files/jobs were removed and canonical
`.github/workflows/ci.yml` restored exactly; PR checks were green at cleanup
head `2bd29d2`. Do **not** treat these CI checks as real inference evidence.

### Acceptance-harness race fix

Status `GET /v1/memory/status?projectId=...` now includes the **ephemeral**
nonnegative integer `lastFinishedAttemptSequence`, initialized to 0 for a
Project in each Context server process. After each automatically scheduled
attempt **finishes**, whether successful or failed, its Project's sequence
increments. It is not an episode count or a durable DB counter. It contains no
raw memories, prompts, provider responses, or sensitive identifiers.

The isolated harness now records that sequence **before** each chat, and its
`settled(projectId)` requires a strictly newer finished sequence plus no
active/queued work. Previously it could mistakenly accept the prior chat's
`lastAttempt="complete"` or `"failed"` while the latest extraction had not yet
started or completed. A synthetic regression holds a second extractor open and
checks that the prior success still has sequence 1 until the second finishes.
This improves verdict attribution only; it cannot speed up Qwen or certify
Hermes answers.

### Remote GPU execution boundary — not yet performed

For full model evidence without a laptop, use only a **separately authorized**
GPU machine with sufficient verified VRAM/RAM/disk for both chosen model
variants. Provisioning cost, provider credentials and GPU access must be
approved before use. Do not introduce silent cloud-model substitution.

- Clone the PR's exact head onto the **temporary remote GPU host** and record
  commit SHA, pinned model names/digests, Ollama version, memory/VRAM and the
  availability of model artifacts. Follow the repository's Node/pnpm lockfile.
- Run native Ollama bound to loopback (`127.0.0.1:11434`) with one model loaded
  at a time; reject exposed inference ports and disable hosted paid calls.
- Use **only generated synthetic Project QA messages**, the isolated SQLite
  files created by `scripts/project-memory-local-acceptance.mjs`, and the
  explicit command:
  `node --import tsx scripts/project-memory-local-acceptance.mjs qwen3.5:9b hermes3:latest`.
  Confirm model identities before invoking; no automatic download/alias
  substitution inside the harness.
- Collect status sequence, extraction latency, prompt bytes, fact provenance,
  exact direct/paraphrased answers, per-Project isolation, persistence, retry
  and CLOUD_ALLOWED/LOCAL_ONLY boundaries. Keep any raw prompt/logs private
  and excluded from Git.
- Report **PASS/FAIL/BLOCKED per case**, distinguishing model/hardware failure
  from service failure. Synthetic remote GPU PASS does **not** satisfy the
  operator's outstanding original-UI acceptance. No production database,
  LOCAL_ONLY user records or backups may be uploaded to any third-party host.

Until the GPU is authorized and the above acceptance completed, PR #467 stays
**DRAFT / NOT READY TO MERGE**.
