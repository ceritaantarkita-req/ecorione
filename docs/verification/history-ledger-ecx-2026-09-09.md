# Historical Ledger + ECX closure evidence — 2026-09-09

Dokumen ini merangkum evidence implementasi untuk ADR-18 dan ADR-19. Ia tidak menggantikan hasil CI; status merge hanya boleh ditentukan dari gate repository pada exact head commit.

## Historical Ledger

Evidence yang dikunci oleh implementation dan regression suite:

- event sequence dimulai dari `0`, contiguous, dan append dapat memakai `expectedSeq`;
- committed `history_events` tidak dapat di-UPDATE atau DELETE pada boundary SQLite;
- retry EventId dengan draft identik dideduplicate, sedangkan EventId sama dengan draft berbeda ditolak;
- payload dinormalisasi sebagai JSON dan event disambungkan dengan `prevHash` + SHA-256 hash;
- read memverifikasi committed chain dan gagal tertutup ketika data ditamper;
- scope, sensitivity, dan sync-class tetap menjadi privacy grant;
- hosted read tidak dapat membuka `LOCAL_ONLY` history;
- multi-event provenance memakai atomic batch transaction: seluruh batch commit atau seluruh batch rollback;
- ensured session sensitivity hanya dapat naik, tidak dapat turun diam-diam; scope/sync-class yang berubah pada SessionId sama adalah conflict;
- live `/v1/chat` mencatat chronological `user.message` → `model.called` → `agent.message` sambil mempertahankan Context sebagai episodic-memory owner;
- kegagalan Ledger setelah provider berhasil menghasilkan audit `HISTORY_WRITE_FAILED` dan tidak mengubah provider success menjadi retryable failure.

## ECX

Evidence yang dikunci oleh implementation dan regression suite:

- planner membuang kandidat tanpa capability overlap;
- recipient dipilih berdasarkan overlap, estimated cost, lalu agent ID sebagai deterministic tie-break;
- `maxRecipients` membatasi fan-out dan tidak ada broadcast default;
- duplicate candidate identity ditolak di schema boundary;
- default packet identity diturunkan secara deterministik dari semantic handoff + recipient;
- retry plan identik menghasilkan packet identity yang sama dan provenance Ledger tetap idempotent;
- packet membawa typed references, bukan referenced payload;
- multi-recipient `agent.handoff` provenance dicommit atomically;
- History hydration menghormati scope/sensitivity/sync-class;
- `LOCAL_ONLY` History ditolak untuk hosted-eligible hydration;
- hydration byte budget adalah hard limit dan overflow menghasilkan `413 ECX_HYDRATION_BUDGET_EXCEEDED`;
- Memory Fact hydration memakai Context HTTP ownership boundary dan Artifact hydration memakai Artifact HTTP ownership boundary.

## Efficiency claim boundary

Regression fixture membandingkan pointer-first ECX packet dengan equivalent inline-history fixture dan membuktikan packet reference lebih kecil pada fixture tersebut. Itu **bukan** bukti penghematan token/cost produksi.

Klaim efisiensi produksi baru boleh dibuat setelah telemetry traffic nyata membandingkan setidaknya:

- packet bytes;
- hydrated bytes;
- candidate/recipient count;
- denied references;
- downstream provider token usage;
- actual provider cost terhadap baseline yang setara.

## Closure gate

Repository mendefinisikan `pnpm verify` sebagai gate closure yang mencakup format, lint, typecheck, test, secret scan, dan production build. PR untuk workstream ini harus tetap tidak di-merge sampai seluruh gate pada exact head commit berstatus sukses.
