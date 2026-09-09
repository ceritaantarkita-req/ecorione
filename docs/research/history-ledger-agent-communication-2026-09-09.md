# Riset: Historical Ledger + komunikasi agent hemat konteks

**Tanggal:** 2026-09-09  
**Status:** dasar keputusan implementasi, bukan klaim benchmark ecorione

## Pertanyaan

1. Apa yang layak diadaptasi dari historical/session log DeepSeek Harness?
2. Bagaimana agent ecorione dapat berkomunikasi tanpa terus mengulang konteks panjang?
3. Apakah perlu bahasa khusus/latent channel, atau cukup protokol terstruktur?

## 1. DeepSeek Harness — temuan yang benar-benar relevan

Sumber resmi yang diperiksa:

- DeepSeek Harness `docs/subsystems/session.md`
- DeepSeek Harness `packages/session/session-persistence/README.md`
- DeepSeek Harness session checkpoint policy

DeepSeek memodelkan Session sebagai **append-only log of typed events** dan menjadikannya source of truth untuk interaction history. History model diturunkan dari event log, bukan disimpan sebagai message array paralel. Persistence mempertahankan `seq` yang contiguous, menolak gap, menyediakan durability barrier, dan fail-closed pada format/corruption yang tidak dapat diinterpretasi dengan aman.

### Yang diadaptasi

- event envelope bertipe;
- sequence monoton dan contiguous;
- append-only committed events;
- idempotent event identity;
- suffix/range reads dengan watermark (`afterSeq` → `throughSeq`);
- integrity chain agar committed history tidak diam-diam berubah;
- replay/read model berasal dari event stream;
- unknown event vocabulary ditolak sampai schema version diperbarui.

### Yang tidak dicopy mentah

- implementasi backend DeepSeek;
- format fisik JSONL/Zstd;
- event vocabulary provider/harness-specific;
- asumsi single-writer yang hanya in-process.

Untuk ecorione, SQLite transaction menjadi serialization point v1 sehingga dua writer HTTP tidak bisa mengalokasikan `seq` yang sama tanpa conflict.

## 2. A2A dan MCP

Sumber resmi A2A Protocol menyatakan **v1.0.0** sebagai stable release dan membedakan A2A dari MCP:

- MCP: agent ↔ tool/context;
- A2A: agent ↔ agent, termasuk discovery, task delegation, modalities, dan interoperability antar stack/vendor.

Keputusan: **jangan menciptakan pengganti A2A.** ECX adalah representation/optimization layer internal ecorione. Jika agent eksternal perlu dihubungkan, Connect menjadi adapter ECX ↔ A2A.

Sumber:

- https://a2a-protocol.org/latest/specification/
- https://a2a-protocol.org/dev/blog/2026/03/12/a2a-protocol-ships-v10-production-ready-standard-for-agent-to-agent-communication/

## 3. Sparse communication

### AgentDropout

Paper AgentDropout (Wang et al., 2025; arXiv:2503.18891) mengoptimalkan communication graph dengan menghilangkan agent/edge redundant. Paper melaporkan rata-rata pengurangan **21.6% prompt tokens** dan **18.4% completion tokens** pada eksperimen mereka, disertai peningkatan task score rata-rata 1.14.

Interpretasi untuk ecorione: jangan broadcast packet ke semua agent. Router harus deterministik, capability-aware, dan hanya memilih recipient yang relevan.

Repo: https://github.com/wangzx1219/AgentDropout

### MOC

MOC (Guan et al., 2026; arXiv:2606.02359) menyorot kelemahan concatenation pesan first-order dan menggunakan structured multi-order evidence + message consolidation di bawah token constraint.

Interpretasi: ECX packet perlu `need`, references, delta, dan budget; full evidence dihydrate hanya jika dibutuhkan.

Repo/paper: https://github.com/yao-guan/MOC ; https://arxiv.org/abs/2606.02359

### PAIRL

Repo eksperimental PAIRL fokus pada efficient, cost-trackable agent communication dan dual channels. Berguna sebagai design reference, tetapi bukan standard dan adopsinya masih kecil. Tidak ada kode yang dicopy.

Repo: https://github.com/dwehrmann/PAIRL

## 4. "QR antar AI" — ide yang dipertahankan

QR image literal tidak dipakai karena menambah encode/decode/vision overhead.

Inti idenya diubah menjadi **reference ticket**:

```json
{
  "version": 1,
  "intent": "review",
  "need": ["security", "correctness"],
  "refs": [
    { "kind": "history", "sessionId": "sess_...", "afterSeq": 120, "throughSeq": 127 },
    { "kind": "artifact", "artifactId": "art_..." },
    { "kind": "memoryFact", "factId": "mem_..." }
  ],
  "budget": { "maxHydratedBytes": 12000 },
  "responseMode": "delta"
}
```

Packet kecil membawa **alamat + maksud**, bukan salinan semua data. Receiver menghydrate hanya reference yang benar-benar diperlukan dan diizinkan policy/classification.

## 5. Symbolic/latent language

Interlat (Du et al., ACL 2026) menunjukkan komunikasi langsung di latent space dan melaporkan inference acceleration hingga 24× pada eksperimen kompresinya sambil mempertahankan performa kompetitif. Paper tersebut sendiri memosisikan hasilnya sebagai feasibility study.

Sumber: https://aclanthology.org/2026.acl-long.1248/

Keputusan ecorione:

- **production v1:** structured ECX packets + human-auditable references;
- **RnD:** symbolic vocabulary yang bisa dibandingkan terhadap natural-language baseline;
- **RnD saja:** latent communication. Tidak menjadi default sebelum portability, model compatibility, privacy, debuggability, dan auditability terbukti.

## 6. Arsitektur hasil riset

```text
Agent/Flow
   │
   ▼
Hub communication planner
   │
   ├── Historical Ledger (Hub durable subsystem)
   ├── Context refs
   └── Artifact refs
   │
   ▼
ECX compact packet
   │
   ├── internal agent → selective hydration
   └── external agent → Connect A2A adapter (deferred boundary)
```

Historical Ledger dan ECX **bukan modul produk baru**. Keduanya adalah subsystem dari Hub/Connect sehingga registry 11 modul tetap valid.

## 7. Ukuran keberhasilan ecorione

Jangan mengklaim penghematan paper sebagai penghematan ecorione. Benchmark internal harus mengukur setidaknya:

- bytes packet sebelum/ sesudah reference substitution;
- bytes yang benar-benar dihydrate;
- prompt/completion tokens per handoff dari telemetry provider;
- jumlah recipient per handoff;
- latency;
- task success/verification score;
- hydration denied karena scope/sensitivity;
- history replay/integrity failures.

Baseline wajib dibandingkan dengan full-context natural-language handoff pada task yang sama.

## 8. Kesimpulan

Implementasi paling defensible sekarang adalah **Historical Ledger + ECX pointer-first communication + sparse routing**. A2A dipertahankan sebagai interoperability standard di boundary. Symbolic dan latent channels dimasukkan ke RnD, bukan core production, sampai ada evidence ecorione sendiri.