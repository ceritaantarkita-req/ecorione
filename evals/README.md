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

## W15 — agent/model eval

W15 sekarang punya harness lokal executable yang terpisah dari product runtime:

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

Pada setiap run gagal, terminal menampilkan failure stage (`call`, `parse`, atau `execute`) dan alasan ringkas. Bila parsing gagal setelah model sudah merespons, trace tetap mempertahankan latency/token call dan menyimpan preview output maksimal 400 karakter supaya kegagalan protocol tidak salah terbaca sebagai `0 ms / 0 token`.

Exploratory run bila runtime tidak menyediakan provenance yang dapat diverifikasi:

```bash
pnpm eval:agentic:local -- --allow-unverified-identity
```

Output evidence ditulis ke `traces/w15-agentic-eval-*.json` dan direktori tersebut memang tidak di-commit karena dapat memuat detail runtime operator.

`promptfooconfig.yaml` tetap dipertahankan sebagai ruang eksperimen prompt/model tambahan, tetapi bukan source of truth untuk trace `reason/tool/execute/observe/verify` W15. Source of truth W15 adalah executable harness di atas.