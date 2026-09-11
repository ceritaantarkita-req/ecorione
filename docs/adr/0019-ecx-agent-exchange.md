# ADR-19 — ECX pointer-first agent exchange; A2A di external boundary

**Status:** Diterima · 2026-09-09 · evidence-boundary clarification 2026-09-11

## Konteks

Natural-language handoff yang menyalin ulang history, artifact, memory, dan tool result memboroskan context window dan membuat multi-agent graph cepat membesar. Membuat proprietary replacement untuk A2A juga akan menghasilkan interoperability debt.

## Keputusan

**ECX (Ecorione Compact Exchange)** adalah representation/optimization layer internal yang dimiliki Hub.

Packet ECX hanya membawa:

- intent/task singkat;
- capability/`need` yang benar-benar dibutuhkan;
- typed references ke History, Artifact, dan Memory Fact;
- hydration byte budget;
- response mode (`delta` atau `full`);
- sender/recipient dan operation identity.

Raw referenced data **tidak disalin ke packet**. Receiver/caller meminta hydration secara eksplisit. Hub melakukan classification gate sebelum memanggil owner service melalui API.

### Routing

Planner bersifat deterministik dan sparse:

1. kandidat tanpa capability yang cocok dibuang;
2. recipient diurutkan berdasarkan overlap capability tertinggi, lalu estimated cost, lalu agent ID untuk tie-break deterministic;
3. `maxRecipients` membatasi fan-out;
4. tidak ada broadcast default.

Determinisme berlaku di core planner, bukan hanya adapter HTTP. Default `packetId` diturunkan secara deterministik dari semantic handoff + recipient, sedangkan duplicate candidate identity ditolak di schema boundary. Retry request identik karena itu menghasilkan packet identity yang sama dan dapat dideduplicate oleh Historical Ledger.

### Provenance commit

Jika plan menghasilkan lebih dari satu recipient dan `historySessionId` diberikan, semua `agent.handoff` untuk plan tersebut ditulis melalui satu Historical Ledger batch transaction. Tidak boleh ada partial committed fan-out provenance ketika salah satu append gagal.

### Hydration

- History range dibaca dari Historical Ledger Hub.
- Memory Fact dibaca dari Context HTTP API.
- Artifact dibaca dari Artifact HTTP API.
- `maxHydratedBytes` adalah hard byte budget.
- denied/missing reference gagal eksplisit; tidak silently menghapus evidence.
- `LOCAL_ONLY` History tidak dapat dihydrate sebagai hosted-eligible context.
- current `/v1/exchange/hydrate` menerima **caller-supplied `refIndexes`**; hydrator tidak memilih reference secara semantik/autonom.

Konsekuensinya, kemampuan selective hydration yang sudah ada berbeda dari **automatic reference selection**. ECORIONE tidak boleh diklaim memiliki selector otomatis hanya karena caller dapat meminta subset reference.

### A2A

A2A Protocol v1.0 adalah standard interoperability eksternal. ECX **tidak menggantikannya**. Adapter ECX ↔ A2A berada di Connect ketika ada external-agent use case nyata. Tidak menambah dependency A2A ke core sebelum ada acceptance host/peer nyata.

### Symbolic/latent channels

- symbolic vocabulary boleh diuji di RnD;
- latent-space communication tetap RnD-only;
- production packet harus human-auditable dan schema-validated.

## Telemetry

Planner/hydrator harus menghasilkan measurement yang dapat dibandingkan terhadap full-context baseline: packet bytes, hydrated bytes, candidate/recipient count, denied refs, dan provider token usage di downstream call. Paper eksternal bukan evidence penghematan ecorione.

Regression suite menyertakan fixture yang membandingkan pointer-first packet dengan equivalent inline-history payload untuk membuktikan properti ukuran packet secara lokal. Klaim penghematan produksi tetap membutuhkan measurement traffic nyata dan tidak boleh disimpulkan hanya dari fixture tersebut.

### Comparative evidence clarification — 2026-09-11

Local traffic/integrity evidence sudah membuktikan real ECX plan, `agent.handoff`, dan hydration melalui owner boundary. Itu tetap bukan savings proof.

Untuk comparative local R&D, protocol resmi saat ini ada di `docs/comparative-ecx-evidence.md` dan memisahkan tiga lane:

- `full-inline` — baseline full context;
- `ecx-all` — ECX packet + hydrate semua refs untuk mengontrol efek transport;
- `ecx-selective-oracle` — hanya fixture-declared relevant refs dihydrate.

Nama `oracle` sengaja eksplisit karena reference subset diketahui dari answer-key fixture, bukan ditemukan oleh selector produksi. Hasil lane tersebut hanya boleh dipakai untuk mengukur **potential/upper bound of correct selective hydration**.

Jika evidence menunjukkan potential yang cukup besar, automatic selector dapat diusulkan sebagai scope baru. Selector tersebut harus punya evaluation sendiri terhadap oracle dan full-inline baseline, termasuk false omission/quality regression. ADR ini tidak mengotorisasi selector baru secara implisit.

Local provider-token `actualUsd=0` tidak membuktikan hosted billed-cost savings. Hosted cost evidence membutuhkan equivalent paired tasks, operator-owned credentials melalui Connect Vault, explicit spend limits, dan actual provider billing telemetry bila tersedia.

## Konsekuensi

- agent handoff bisa mengirim reference ticket kecil;
- context hanya dihydrate saat diminta;
- Hub tetap supervisor komunikasi/policy;
- Connect tetap interoperability boundary;
- format internal dapat dioptimalkan tanpa mem-fork standard A2A;
- selective hydration bisa diukur tanpa melebih-lebihkan kemampuan selector;
- negative comparative result diterima sebagai evidence dan tidak memaksa pembangunan optimizer baru.
