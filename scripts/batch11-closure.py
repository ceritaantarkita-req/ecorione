from pathlib import Path

path = Path("docs/EXECUTION-PROGRESS.md")
text = path.read_text()


def replace_once(old: str, new: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f"expected tracker block missing: {old[:100]!r}")
    text = text.replace(old, new, 1)


replace_once(
    "Batch 10 implementation is merged and post-merge verified on `main`:\n\n- implementation PR #25 merge: `f5232048f29efa4d4b6632330f0d860afa781d48`\n- exact final PR head: `3459e4b51ff5c04eeb129ed2463cb0545d9a6ef8`\n- exact-head CI `34442113246`: full green\n- exact-head MCP External HTTPS Acceptance `34442113341`: PASS\n- post-merge main CI `34443543782`: full green",
    "Batch 11 implementation is merged and post-merge verified on `main`:\n\n- implementation PR #27 merge: `2e52af3bb8652154bd70846120767b67297bc1fd`\n- exact final PR head: `8056db267dd30203e9208a7ccc3fcfb07390bf2c`\n- exact-head CI `34448405724`: full green, including Production Operations acceptance\n- exact-head MCP External HTTPS Acceptance `34448405823`: PASS\n- post-merge main CI `34448620805`: full green",
)
replace_once(
    "- Batch 10 status: **CLOSED**\n- next implementation target: **Batch 11 — Production Operations & Observability**",
    "- Batch 10 status: **CLOSED**\n- Batch 11 status: **CLOSED**\n- next implementation target: **Batch 12 — Final Security / Release Closure**",
)
replace_once(
    "Dari current state, **Batch 1–10 sudah CLOSED**. Tersisa **2 batch platform/production (Batch 11–12)**; next implementation target adalah **Batch 11 — Production Operations & Observability**.",
    "Dari current state, **Batch 1–11 sudah CLOSED**. Tersisa **1 batch platform/production (Batch 12)**; next implementation target adalah **Batch 12 — Final Security / Release Closure**.",
)

start = text.index("## Batch 11 — Production Operations & Observability")
end = text.index("## Batch 12 — Final Security / Release Closure", start)
section = """## Batch 11 — Production Operations & Observability

Status: **CLOSED**

Scope:

- managed/self-host deployment recipe
- Temporal deployment
- Docker/Compose deployment baseline
- HTTPS/reverse-proxy recipe
- persistent volumes
- provider canary
- real-provider quality floor
- cost metrics
- token metrics
- latency p50/p95
- error rate
- cache-hit metrics
- MCP/tool metrics
- node/workflow metrics
- ECX packet/hydration telemetry
- unified distributed trace
- health/operations dashboard

Important:

> Tidak ada production efficiency/cost-saving claim untuk ECX sebelum telemetry nyata tersedia.

Implemented baseline:

- bounded owner-local HTTP metrics with p50/p95/error-rate projection;
- W3C-compatible trace context + request-ID propagation across shared internal HTTP;
- protected service `/metrics` and `/v1/ops/observability`;
- Connect cost/token/cache/provider-canary telemetry;
- outbound MCP latency/outcome telemetry;
- Hub ECX packet/hydration traffic telemetry without savings claims;
- Flow workflow/node/approval/input telemetry;
- Ai `/ops` health/metrics/distributed-trace aggregation;
- pinned Docker/Compose self-host baseline with Temporal/PostgreSQL/Caddy;
- owner-scoped persistent volumes and Caddy-only published host ports;
- inbound MCP remains loopback-only through Sync network namespace;
- no Docker socket mounted into the application/Sandbox baseline;
- provider canary runs through the normal Connect completion/vault/spend/cost boundary;
- Production Operations acceptance is a permanent CI gate.

Closure evidence:

- implementation branch: `agent/batch11-production-ops-observability-20260910`;
- implementation PR: #27;
- pre-PR verifier `34447593177`: Typecheck, focused observability/provider-canary tests, and real Compose config acceptance PASS;
- final exact implementation head: `8056db267dd30203e9208a7ccc3fcfb07390bf2c`;
- exact-head CI `34448405724`: Naming, Format, Lint, Typecheck, Test, Phase 4 real-process acceptance, Production Operations acceptance, Secret Scan, Production Build PASS;
- exact-head MCP External HTTPS Acceptance `34448405823`: PASS;
- PR #27 merged with expected-head lock as `2e52af3bb8652154bd70846120767b67297bc1fd`;
- post-merge `main` CI `34448620805`: full green;
- temporary Batch 11 helper workflows/scripts are absent from the implementation tree.

Evidence boundary: deterministic CI validates the canary mechanism with a local compatible stub; it does not claim real hosted-provider quality/latency. Process metrics are not durable time-series storage, and ECX traffic metrics do not establish savings.

ADR: `docs/adr/0032-production-operations-observability.md`  
Operations: `docs/production-operations.md`  
Verification: `docs/verification/batch11-production-ops-2026-09-10.md`

Batch 11 resmi **CLOSED**; next implementation batch adalah Batch 12.

---

"""
text = text[:start] + section + text[end:]

replace_once(
    "- **Batch 10: CLOSED**\n- **2 platform/production batches remaining (Batch 11–12)**\n- next: **Batch 11 — Production Operations & Observability**",
    "- **Batch 10: CLOSED**\n- **Batch 11: CLOSED**\n- **1 platform/production batch remaining (Batch 12)**\n- next: **Batch 12 — Final Security / Release Closure**",
)
replace_once(
    "Heuristic percentage/granular workload estimates sengaja tidak dihitung ulang pada closure Batch 10.",
    "Heuristic percentage/granular workload estimates sengaja tidak dihitung ulang pada closure Batch 11.",
)

path.write_text(text)
