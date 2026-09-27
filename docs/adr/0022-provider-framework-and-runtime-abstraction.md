# ADR-22 — Provider Framework dan Local Runtime Abstraction

Status: Accepted
Tanggal: 2026-09-09

## Context

Connect sebelumnya memiliki jalur hosted yang secara efektif berpusat pada Anthropic dan jalur local yang default-nya menunjuk endpoint Ollama. Itu cukup untuk baseline awal, tetapi tidak cukup untuk kebutuhan provider multi-vendor, OpenRouter, direct OpenAI, dan local runtime yang dapat diganti tanpa mengubah orchestration core.

Provider selection juga menyentuh boundary yang sensitif: credential, model identity, pricing, cache key, spend budget, dan failure semantics. Karena itu provider tidak boleh dipilih secara implisit oleh output model atau alias provider yang dapat drift.

## Decision

1. Connect tetap menjadi satu-satunya outbound model gateway.
2. Hosted provider yang didukung pada baseline ini: `anthropic`, `openrouter`, `openai`, `nvidia`.
3. Hosted provider dipilih dari process configuration `ECORIONE_HOSTED_PROVIDER`; default tetap `anthropic` untuk backward compatibility.
4. Credential production tetap dibaca melalui Connect Credential Vault dengan scope `<provider>/messages`. Environment API key hanya fallback development jika vault tidak aktif.
5. Routing menghasilkan **pinned cost identity**. Runtime model slug provider dipetakan secara eksplisit oleh adapter. Alias seperti `gpt-5.6` atau bentuk `latest` tetap dilarang oleh ADR-14.
6. OpenRouter menggunakan canonical explicit model slug; tidak memakai auto-router atau model alias yang dapat drift tanpa diff.
7. OpenAI direct menggunakan explicit model identity yang ada di pricing snapshot.
8. NVIDIA API Catalog menggunakan endpoint OpenAI-compatible tetap `https://integrate.api.nvidia.com/v1` dan pinned runtime identity `z-ai/glm-5.3`; credential production tetap `nvidia/messages` di Connect Vault. Boundary ini khusus hosted **free prototype endpoint** NVIDIA, bukan partner endpoint, self-hosted NIM, atau NVIDIA AI Enterprise production.
9. Local inference memakai `openai-compatible` runtime contract. Ollama hanyalah salah satu implementasi; llama.cpp server, LM Studio, atau runtime lain boleh dipakai selama kontraknya kompatibel dan operator mengkonfigurasi endpoint/model secara eksplisit.
10. Durable spend budget menyimpan provider pada setiap reservation dan berlaku untuk semua hosted provider.
11. Pre-dispatch reservation dihitung konservatif dari pinned price snapshot. Jika provider mengembalikan billed cost authoritative (saat ini OpenRouter `usage.cost`), nilai tersebut menjadi `actualUsd` untuk ledger dan settlement. Jika field authoritative hadir tetapi malformed, provider result ditolak fail-closed.
12. Cache key memasukkan provider identity supaya hasil provider berbeda tidak berbagi exact-match cache secara tidak sengaja.
13. Tidak ada silent fallback antar-hosted-provider maupun hosted→local. Failure harus terlihat ke caller.

## OpenAI pricing evidence

Snapshot GPT-5.6 diverifikasi 2026-09-09 terhadap dokumentasi resmi:
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models

Snapshot tetap harus diverifikasi ulang sebelum public billing/savings claim karena provider pricing dapat berubah.

## NVIDIA prototype endpoint evidence

NVIDIA API Catalog diverifikasi 2026-09-28 terhadap dokumentasi resmi:

- `https://build.nvidia.com/z-ai/glm-5-3`
- base URL `https://integrate.api.nvidia.com/v1`
- Chat Completions `POST /v1/chat/completions`
- runtime model `z-ai/glm-5.3`
- NVIDIA API key environment convention `NVIDIA_API_KEY`
- halaman model menyatakan **Free Endpoint Available** untuk prototype.

Karena `FileSpendBudget` mewajibkan reservation positif, adapter NVIDIA mempertahankan admission-control/ambiguous-failure semantics dengan reservation minimum USD 0.000001, lalu accounting token provider untuk route prototype ini tetap USD 0. Ini bukan klaim bahwa partner/self-hosted/production NVIDIA gratis.

## Consequences

- Ecorione tidak bergantung pada Ollama sebagai runtime wajib.
- User dapat memakai OpenRouter atau NVIDIA API key melalui vault atau fallback development.
- Menambah hosted provider berikutnya harus melalui adapter + pinned model mapping + credential scope + spend accounting + tests; bukan conditional ad-hoc di Hub.
- Provider-reported billed cost dapat lebih akurat daripada token×snapshot, tetapi token telemetry dan pinned price table tetap disimpan sebagai audit/baseline data.
- Provider selection tetap deterministic dan dapat direplay dari configuration + code version.

## Non-goals

- Automatic cheapest-provider routing.
- Model/provider selection oleh LLM output.
- Dynamic arbitrary provider plugins tanpa permission/manifest layer.
- Menganggap OpenAI-compatible berarti seluruh vendor mempunyai semantics identik.
