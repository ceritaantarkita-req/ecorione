# Architecture Decision Records

Dua puluh tiga keputusan yang membentuk ecorione, masing-masing dengan angka atau riset yang
mendukungnya. Alasan lengkap keputusan awal ada di [`../research.md`](../research.md),
sedangkan keputusan fase lanjutan juga merujuk dokumen fase terkait.

| ADR | Keputusan |
|---|---|
| [01](0001-prefix-stability.md) | Prefix stabil sebagai requirement kelas satu |
| [02](0002-deterministic-routing.md) | Routing deterministik, bukan prediksi kualitas |
| [03](0003-no-semantic-cache.md) | Tidak ada semantic caching di v1 |
| [04](0004-local-model-role.md) | Model lokal adalah classifier, bukan agent |
| [05](0005-sqlite-not-graph.md) | SQLite + FTS5 + sqlite-vec, bukan graph DB |
| [06](0006-append-only-log.md) | Log append-only sebagai ground truth |
| [07](0007-quarantine.md) | Tulisan model hosted masuk karantina |
| [08](0008-adopt-durable-execution.md) | Adopsi durable execution, jangan bangun sendiri |
| [09](0009-mcp-server-first.md) | Server MCP dulu; semua fungsi lewat tools |
| [10](0010-tiered-sandbox.md) | Sandbox bertingkat; bukan "secure sandbox" |
| [11](0011-rpa-controls.md) | RPA turun ke P2 dengan kontrol khusus |
| [12](0012-idempotency.md) | Idempotency key wajib pada setiap efek samping |
| [13](0013-counterfactual-cost.md) | Akuntansi biaya kontrafaktual |
| [14](0014-pinned-models.md) | Pin versi model; canary harian |
| [15](0015-mit-license.md) | Lisensi MIT; hindari sumber AGPL |
| [16](0016-sync-reachability.md) | Sync v1 memakai tunnel pihak ketiga / self-hosted bridge |
| [17](0017-temporal-for-flow.md) | Flow memakai Temporal untuk durable execution |
| [18](0018-historical-ledger.md) | Historical Ledger adalah subsystem durable Hub |
| [19](0019-ecx-agent-exchange.md) | ECX pointer-first untuk exchange internal agent |
| [20](0020-connect-credential-vault.md) | Connect memiliki credential vault terenkripsi at-rest |
| [21](0021-durable-spend-budget.md) | Connect melakukan durable reservation sebelum hosted spend |
| [22](0022-provider-framework-and-runtime-abstraction.md) | Connect memakai provider framework + local runtime abstraction |
| [23](0023-outbound-mcp-client-manager.md) | Connect memiliki outbound MCP client/manager dengan Hub governance |

Keputusan yang mengubah invarian di [`../../AGENTS.md`](../../AGENTS.md) butuh ADR baru,
bernomor urut, dengan konteks → keputusan → konsekuensi. Keputusan biasa cukup satu baris
di [`../DECISIONS.md`](../DECISIONS.md).
