# Verification — Provider Framework + OpenRouter/OpenAI — 2026-09-09

## Scope

Workstream ini memperluas Connect menjadi multi-provider gateway tanpa memindahkan security/cost boundary keluar dari Connect:

- Anthropic direct tetap didukung.
- OpenRouter dan OpenAI direct ditambahkan melalui adapter eksplisit.
- Credential production tetap provider-scoped di Connect Credential Vault.
- Exact cache dan durable spend reservation memasukkan provider identity.
- OpenRouter `usage.cost`, bila tersedia dan valid, menjadi billed `actualUsd` untuk cost ledger + durable spend settlement.
- Local inference memakai contract OpenAI-compatible; Ollama bukan dependency wajib.
- Tidak ada silent provider fallback, hosted→local fallback, alias `latest`, atau OpenRouter auto-router.

## Code evidence

Regression yang relevan:

- `services/connect/src/provider-selection.test.ts` — provider config/vault scope dan no silent fallback.
- `services/connect/src/providers/hosted.test.ts` — OpenRouter/OpenAI adapter mapping, usage/cost parsing, unsupported mapping fail-closed.
- `services/connect/src/provider-cost-integration.test.ts` — OpenRouter provider-reported billed cost mengalir sampai `CallCostRecord.actualUsd` dan Durable Spend Budget settlement.
- `packages/shared-telemetry/src/provider-cost.test.ts` — billed-cost override authoritative dan nilai invalid ditolak.
- `services/connect/src/spend-budget.test.ts` — provider-aware durable reservation tetap memenuhi restart/concurrency/cap semantics.
- `services/connect/src/routing.test.ts` — provider-specific pinned model selection deterministic.
- `packages/shared-telemetry/src/pricing.test.ts` — pinned model table, alias rejection, dan pricing invariants.

## Exact-head CI evidence sebelum docs-final commit

Branch code/docs candidate HEAD: `58f04b23ec4643ee9d93d92c92ea405e064132a7`

GitHub Actions run `34342955729`, attempt 2:

- Naming: PASS
- Format: PASS
- Lint: PASS
- Typecheck: PASS
- Test: PASS
- Secret Scan: PASS
- Production Build: PASS

Attempt 1 pada SHA yang sama mengalami satu timeout di acceptance Fase 4 lama saat menunggu durable Hub approval, sebelum provider path dipakai. Semua provider regression pada attempt tersebut sudah PASS. Rerun exact SHA tanpa perubahan kode lulus seluruh gate; evidence ini dicatat sebagai timing flake satu kali, bukan provider failure.

Dokumen ini sendiri mengubah HEAD, sehingga merge tetap dilarang sampai **docs-final exact HEAD** juga lulus seluruh closure gate.

## External pricing/source verification

Snapshot GPT-5.6 diverifikasi 2026-09-09 terhadap dokumentasi resmi OpenAI:

- `https://developers.openai.com/api/docs/models/gpt-5.6-sol`
- `https://developers.openai.com/api/docs/models/gpt-5.6-terra`
- `https://developers.openai.com/api/docs/models`

Model/provider pricing dapat berubah. Snapshot repository tidak boleh dianggap billing authority tanpa verifikasi ulang sebelum public billing/savings claim.

## Claim boundary

Yang dibuktikan workstream ini:

- provider adapter contract dan deterministic selection;
- provider-scoped credentials;
- local runtime tidak terikat Ollama;
- provider-aware cache/spend accounting;
- provider-reported OpenRouter cost threading;
- deterministic CI tanpa external credentials.

Yang **belum** dibuktikan:

- production connectivity dengan credential user nyata;
- daily real-provider canary;
- external MCP/public network acceptance;
- multi-host transactional spend store;
- public savings claim berdasarkan real production traffic.

Workstream berikutnya tetap harus menguji boundary eksternal secara terpisah; unit/mock/CI evidence di sini tidak menggantikan production acceptance.
