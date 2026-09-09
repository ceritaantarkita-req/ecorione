# ADR-19 — ECX pointer-first agent exchange; A2A di external boundary

**Status:** Diterima · 2026-09-09

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

Raw referenced data **tidak disalin ke packet**. Receiver meminta hydration secara eksplisit. Hub melakukan classification gate sebelum memanggil owner service melalui API.

### Routing

Planner bersifat deterministik dan sparse:

1. kandidat tanpa capability yang cocok dibuang;
2. recipient diurutkan berdasarkan overlap capability tertinggi, lalu estimated cost, lalu agent ID untuk tie-break deterministic;
3. `maxRecipients` membatasi fan-out;
4. tidak ada broadcast default.

### Hydration

- History range dibaca dari Historical Ledger Hub.
- Memory Fact dibaca dari Context HTTP API.
- Artifact dibaca dari Artifact HTTP API.
- `maxHydratedBytes` adalah hard byte budget.
- denied/missing reference gagal eksplisit; tidak silently menghapus evidence.

### A2A

A2A Protocol v1.0 adalah standard interoperability eksternal. ECX **tidak menggantikannya**. Adapter ECX ↔ A2A berada di Connect ketika ada external-agent use case nyata. Tidak menambah dependency A2A ke core sebelum ada acceptance host/peer nyata.

### Symbolic/latent channels

- symbolic vocabulary boleh diuji di RnD;
- latent-space communication tetap RnD-only;
- production packet harus human-auditable dan schema-validated.

## Telemetry

Planner/hydrator harus menghasilkan measurement yang dapat dibandingkan terhadap full-context baseline: packet bytes, hydrated bytes, candidate/recipient count, denied refs, dan provider token usage di downstream call. Paper eksternal bukan evidence penghematan ecorione.

## Konsekuensi

- agent handoff bisa mengirim reference ticket kecil;
- context hanya dihydrate saat perlu;
- Hub tetap supervisor komunikasi/policy;
- Connect tetap interoperability boundary;
- format internal dapat dioptimalkan tanpa mem-fork standard A2A.