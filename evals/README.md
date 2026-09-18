# Eval harness

ECORIONE memisahkan dua lapisan eval supaya product regressions tidak tercampur dengan kualitas model.

## W14 — deterministic product eval

`product-regressions.json` adalah manifest bounded untuk kasus yang berasal dari **bug atau tugas nyata**. Setiap kasus wajib menunjuk:

- provenance repository (`origin.source` + `origin.ref`);
- deterministic regression test yang benar-benar ada (`target.file` + `target.testName`);
- expected product invariant yang dilindungi.

`product-regressions.test.ts` memvalidasi provenance, uniqueness, batas 50 kasus, dan memastikan target regression masih ada. Workflow `.github/workflows/product-eval.yml` kemudian menjalankan manifest validator bersama seluruh deterministic target yang direferensikan suite.

Current W14 seed berisi 12 kasus lintas Settings/MCP, owner-boundary security, local runtime/model identity, provider credential flow, Ai chat/memory, dan Operations degraded/optional-service behavior. Ini **bukan** pengukuran kualitas model dan tidak boleh dipakai sebagai claim agentic success.

Aturan penambahan kasus tetap sama: kalau sebuah kasus baru tidak bisa menunjuk bug/tugas nyata dan deterministic regression yang membuktikannya, kasus belum boleh masuk. Bila target file baru ditambahkan ke manifest, tambahkan file tersebut juga ke workflow Product Eval supaya regression-nya benar-benar dieksekusi.

## F6-E01 — held-out ECX selector regression

F6-E01 menambahkan `ecx-selector-heldout.json` sebagai dataset regresi deterministic untuk `semantic-v1`. Scope ini sengaja memakai **kasus yang belum menjadi fixture W17/W18**, tetapi tetap wajib berasal dari bug/tugas repository yang nyata.

Current manifest berisi **10 kasus** lintas MCP workspace routing, owner redirect security, realtime voice, local-runtime URL policy, immutable model identity, W18 single-attempt authorization, Operations degraded/optional semantics, memory Forget, transient provider credentials, dan explicit Local chat routing.

Aturan penting:

- setiap case punya `origin.source` + `origin.ref` yang diverifikasi benar-benar ada;
- `relevant` hanya label evaluation/oracle di manifest;
- test menghapus label tersebut sebelum memanggil `selectEcxReferenceIndexes`;
- selector hanya menerima intent/task/need, descriptor text, dan `maxRefs`;
- semua expected relevant refs harus muncul di hasil selector dan hasil tidak boleh melewati budget;
- tidak ada provider/model call dalam suite ini.

`eval-inventory.test.ts` sekarang menghitung seluruh governed eval manifests: 12 W14 + 4 W15 + 10 F6-E01 = **26 kasus**, tetap di bawah hard ceiling permanen **50** dan seluruh ID harus unik lintas manifest.

Jalankan langsung:

```bash
pnpm eval:selector:heldout
```

Claim boundary: PASS F6-E01 hanya membuktikan deterministic selector regression pada 10 kasus bug/task-derived ini. Ia tidak membuktikan kualitas jawaban model, hosted cost, representativeness workload produksi, atau universal optimizer effectiveness.

## W15 — agent/model eval

W15 punya harness lokal executable yang terpisah dari product runtime:

- `agentic-cases.json` — task/bug-derived agent cases dan deterministic tool fixtures;
- `agentic-eval-core.mjs` — parser, executor fixture, dan scorer;
- `agentic-eval-core.test.mjs` — CI contract tests untuk harness;
- `scripts/local-agentic-eval.mjs` — runner real local model melalui endpoint OpenAI-compatible.

Harness mengukur lima checkpoint secara eksplisit:

1. **reason** — model memberi short decision rationale, bukan hidden chain-of-thought;
2. **tool** — model memilih tool yang benar dan tidak memilih forbidden write/tool trap;
3. **execute** — harness benar-benar mengeksekusi deterministic tool fixture dengan exact args;
4. **observe** — tool result dikirim balik sebagai `TOOL_OBSERVATION` sebelum final answer;
5. **verify** — final answer harus menyatakan `verified: true` dan lolos assertion deterministik kasus.

Current seed berisi empat kasus nyata: Operations degraded-vs-optional diagnosis, workspace-aware MCP lookup, public `localBaseUrl` rejection, dan immutable local-model identity. Tiap kasus dijalankan **3 kali** dan hanya lulus jika semuanya lulus (`pass^3`).

### Current closure evidence

Pada 2026-09-15, strict run terakhir dijalankan di baseline `00765be1c58198aaacdd867bada83e544fd9edd0` dengan runtime lokal berikut:

```text
baseUrl: http://127.0.0.1:11434/v1
model: qwen3.5:9b
digest: 6488c96fa5faab64bb65cbd30d4289e20e6130ef535a93ef9a49f42eda893ea7
identityVerified: true
```

Hasil strict closure run:

```text
W15-001: 3/3 — PASS^3
W15-002: 3/3 — PASS^3
W15-003: 3/3 — PASS^3
W15-004: 3/3 — PASS^3
allPass3: true
closureEligible: true
trace: traces/w15-agentic-eval-2026-09-15T00-23-08-194Z.json
```

Trace runtime tetap lokal/gitignored karena dapat memuat detail runtime operator. Closure di atas berlaku untuk model identity yang diverifikasi tersebut dan bounded harness saat itu; perubahan model, digest, runtime, atau kasus memerlukan evidence baru.

### Claim boundary W15

Harness ini mengukur kemampuan model lokal dalam **bounded evaluation agent loop**. Ia **tidak** membuktikan bahwa jalur chat produk ECORIONE saat ini sudah menjadi autonomous tool-calling agent. Current product chat masih menggunakan completion pipeline dengan `toolDefinitions: []`; claim tersebut tetap terpisah sampai product runtime benar-benar punya agent loop.

Hasil W15 juga tidak boleh dipakai sebagai reproducible closure evidence bila immutable model identity belum terverifikasi. Runner mencoba membaca runtime model list dan, untuk Ollama-compatible base URL `/v1`, mencocokkan `ECORIONE_LOCAL_MODEL_DIGEST` terhadap `/api/tags`. Run exploratory tanpa verified identity boleh dilakukan dengan flag eksplisit, tetapi `closureEligible` akan tetap `false`.

## Aturan yang mengikat

**Batas keras 50 kasus, selamanya.** Menambah satu berarti memensiunkan satu. Suite yang tumbuh tanpa batas berhenti dijalankan orang, dan suite yang tidak dijalankan tidak melindungi apa pun.

**Setiap kasus harus lahir dari bug atau tugas yang benar-benar pernah terjadi.** Tidak ada coverage spekulatif. Kalau tidak bisa menunjuk kejadian nyatanya, kasusnya belum layak masuk.

**Habiskan usaha pada tracing, bukan pada scoring.** Untuk sistem personal, **kamu sendiri adalah ground truth-nya** — trace viewer yang bagus lebih penting daripada scorer yang kompleks.

## Komposisi target model eval (30–40 kasus)

| Kategori | Jumlah | Catatan |
|---|---|---|
| Happy path | ~15 | Satu per kapabilitas utama |
| **Keamanan** | **~8** | Prompt injection, instruksi tidak dipercaya, dan aksi destruktif; assert penolakan/konfirmasi |
| Pemilihan tool | ~8 | Ada tool salah yang masuk akal sebagai jebakan |
| Permintaan ambigu | ~5 | Jawaban benar bertanya balik, bukan menebak |
| Memori / konteks | ~4 | Retrieval, scope, invalidasi |

## Cara menilai model eval

1. **Assertion deterministik** di mana pun mungkin — nama tool, args, state fixture, forbidden action, expected evidence.
2. LLM-as-judge hanya untuk kasus yang benar-benar tidak dapat dinilai deterministik dan harus dipisahkan dari core pass/fail harness.

## pass^k, bukan pass@k

Tiap kasus model dijalankan **k=3** dan dilaporkan sebagai **pass^3** — ketiganya harus lulus. Ini mengukur keandalan, bukan keberuntungan best-of-n.

## Menjalankan W15

Inventory tanpa inference:

```bash
pnpm eval:agentic:inventory
```

Strict evidence run — default menuntut verified immutable identity:

```bash
ECORIONE_LOCAL_MODEL_DIGEST=<digest-runtime-yang-benar> pnpm eval:agentic:local
```

Inference memakai timeout terpisah dari inventory. Default-nya 120 detik per model call dan dapat dinaikkan secara eksplisit sampai 600 detik untuk runtime lokal yang lambat:

```bash
ECORIONE_AGENTIC_MODEL_TIMEOUT_MS=180000 pnpm eval:agentic:local
```

Pada setiap run gagal, terminal menampilkan failure stage (`call`, `parse`, atau `execute`) dan alasan ringkas. Bila parsing gagal setelah model sudah merespons, trace tetap mempertahankan latency/token call dan menyimpan preview output maksimal 400 karakter supaya kegagalan protocol tidak salah terbaca sebagai `0 ms / 0 token`. Bila deterministic `verify` gagal, runner juga mencetak final answer agar assertion dapat diaudit tanpa membuka seluruh trace.

Exploratory run bila runtime tidak menyediakan provenance yang dapat diverifikasi:

```bash
pnpm eval:agentic:local -- --allow-unverified-identity
```

Output evidence ditulis ke `traces/w15-agentic-eval-*.json` dan direktori tersebut memang tidak di-commit karena dapat memuat detail runtime operator.

`promptfooconfig.yaml` tetap dipertahankan sebagai ruang eksperimen prompt/model tambahan, tetapi bukan source of truth untuk trace `reason/tool/execute/observe/verify` W15. Source of truth W15 adalah executable harness di atas.
