# ECORIONE — Active Work Plan

Last updated: **2026-09-14**

Status: **ACTIVE / canonical execution log for current work**

Dokumen ini adalah living document untuk pekerjaan aktif ECORIONE setelah Phase 4. Setiap pekerjaan yang dilakukan terhadap repository **wajib memperbarui dokumen ini sebelum pekerjaan dianggap selesai**.

## 1. Aturan kerja aktif

1. **Visual current di-freeze.** Jangan redesign sidebar, layout, warna, composer, atau bahasa visual yang sudah ada kecuali ada defect nyata atau kebutuhan fungsi yang tidak bisa diselesaikan tanpa perubahan visual.
2. **Perubahan UX harus mengikuti desain existing.** Fokus saat ini adalah fungsi, onboarding, reliability, observability, dan usability — bukan redesign.
3. **Jangan menambah modul besar baru sebelum gap aktif di bawah ditutup atau ada evidence nyata yang membenarkannya.**
4. **Fase 5 AutoClick tetap DEFERRED BY DESIGN.** Tidak mulai tanpa use case nyata yang tidak dapat diselesaikan melalui API/MCP.
5. **Fase 6+ tetap OPEN-ENDED / evidence-driven.** Tidak ada Phase 7/8 yang diasumsikan otomatis dan tidak ada implicit Batch 13.
6. **Source of truth teknis adalah current code + current evidence + canonical current-state docs.** Historical audit tidak boleh mengalahkan kondisi repository yang lebih baru.
7. **Setiap selesai satu pekerjaan, update dokumen ini terlebih dahulu** dengan status, hasil, evidence, commit/PR, defect/limitation, dan next step.

## 2. Target aktif

Target utama tahap ini adalah mengubah ECORIONE dari sistem yang terutama nyaman bagi developer menjadi produk yang dapat dipasang, dinyalakan, dikonfigurasi, dan digunakan oleh user awam tanpa harus memahami Git, pnpm, Docker, Temporal, atau struktur service internal.

Empat blok utama:

- **A. Stabilkan produk** — UX runtime, testing, attachment, health/error handling.
- **B. Sederhanakan onboarding** — provider credentials, one-command startup, installer/launcher path.
- **C. Stabilkan AI** — immutable model identity, real product eval, agentic local-model validation.
- **D. Buktikan optimizer** — automatic semantic reference selector, ECX tanpa oracle, hosted cost validation.

## 3. Work queue aktif

| ID | Pekerjaan | Status | Definition of done |
|---|---|---:|---|
| W01 | Reconcile `system-analysis-2026-09-13.md` dengan kondisi real repo | **DONE** | Temuan valid/outdated dipisahkan; tidak ada blocker lama yang masih dinyatakan aktif tanpa dasar current code/evidence. |
| W02 | Tutup gap Vitest `*.test.tsx` | **STARTED** | Semua test TSX yang dimaksud masuk discovery normal/CI dan tidak ada silent-skip sejenis yang terlewat. |
| W03 | Audit UX/Product Validation di current `main` | TODO | Full Phase 4 walkthrough current main selesai; defect ledger jelas; tidak ada S0/S1 terbuka. |
| W04 | Rapikan partial-stack vs full-stack behavior | TODO | UI/status tidak menampilkan raw 502 sebagai UX normal; state service yang belum aktif dapat dipahami user. |
| W05 | Provider Settings foundation | TODO | User dapat menghubungkan OpenAI, Anthropic/Claude, OpenRouter, Kimi/Moonshot, Gemini, Qwen, GLM, dan custom OpenAI-compatible tanpa edit `.env` manual. |
| W06 | Credential Vault integration untuk provider keys | TODO | Paste → test → save → masked display → replace/remove; plaintext tidak disimpan di browser/localStorage dan tidak dibaca kembali oleh UI. |
| W07 | Provider health/status | TODO | Status minimal: Connected, Invalid key, Unreachable, Disabled; test connection bounded dan tidak memicu spend tidak terkendali. |
| W08 | Default AI selection | TODO | User dapat memilih Local atau provider/model yang sudah terhubung; auto-router belum diklaim. |
| W09 | One-command full-system startup | TODO | Satu command stabil menyalakan full required stack dan menunggu readiness tanpa langkah manual berantai. |
| W10 | `ecorione doctor` / diagnostics | TODO | Dependency, service health, ports, Temporal/database, local model, dan masalah umum dapat didiagnosis dengan output manusiawi. |
| W11 | Installer/Launcher design & implementation path | TODO | Jalur normal-user didefinisikan sebagai install → open/start → use; Git clone/pnpm bukan requirement end user. |
| W12 | Attachment composer real backend path | TODO | File/foto tidak lagi hanya menjadi label teks; upload → Artifact → Context pointer → controlled hydration terbukti end-to-end. |
| W13 | Immutable local model identity | TODO | Runtime/evidence menggunakan identity/version/digest yang reproducible; mutable `:latest` tidak dipakai untuk durable claims. |
| W14 | Product eval foundation | TODO | Eval cases berasal dari tugas/bug nyata; framework siap menuju target 30–40 kasus tanpa synthetic filler. |
| W15 | Agentic local-model eval v1 | TODO | Local model diuji pada loop reason/choose-tool/execute/observe/verify dengan task completion dan failure modes tercatat. |
| W16 | Automatic semantic reference selector | TODO | `refIndexes` tidak lagi harus dipilih caller/oracle untuk jalur auto-selective; selector terukur dan punya fallback/error semantics eksplisit. |
| W17 | ECX end-to-end tanpa oracle | TODO | Full-context vs auto-selective ECX vs oracle ECX dibandingkan pada task set yang sama. |
| W18 | Hosted economic validation | TODO | Sejumlah kecil call nyata membandingkan actual hosted token/cost full-context vs ECX dengan spend bounded dan operator intent eksplisit. |
| W19 | Release/security governance follow-up | TODO | Full-history secret scan menjadi gate release/CI yang benar-benar dieksekusi; governance `main` diperketat sesuai keputusan operator. |
| W20 | Final current-state sync | TODO | Canonical docs, implementation status, evidence, limitations, dan next checkpoint sinkron dengan repository terbaru. |

## 4. Prioritas eksekusi saat ini

Urutan default selama tidak ada temuan baru yang memaksa reprioritization:

1. W01 — current-state/document reconciliation
2. W02 — test discovery gap
3. W03 — current-main UX/product validation
4. W04 — full/partial stack usability
5. W05–W08 — provider onboarding + Credential Vault
6. W09–W11 — startup, doctor, installer/launcher path
7. W12 — real attachment pipeline
8. W13 — immutable local model identity
9. W14–W15 — product eval + agentic local-model validation
10. W16–W18 — semantic selector, ECX no-oracle, hosted economics
11. W19–W20 — release governance + final synchronization

## 5. Provider onboarding target

Normal user tidak boleh diwajibkan mengedit `.env` untuk menghubungkan model/provider.

Target flow:

```text
Settings → AI Providers → Connect → Paste API key → Test → Save → Choose model
```

Provider baseline:

- OpenAI / ChatGPT API
- Anthropic / Claude API
- OpenRouter
- Kimi / Moonshot
- Google Gemini
- Qwen
- GLM
- Custom OpenAI-compatible endpoint

Security baseline:

- credential authority tetap **Connect / Credential Vault**;
- plaintext key tidak disimpan di browser/localStorage;
- setelah tersimpan UI hanya melihat metadata/masked identity;
- replace/remove/test harus eksplisit;
- provider call tetap tunduk pada hosted-call policy dan spend control.

## 6. Startup/onboarding target

Tiga kelas penggunaan harus dipisahkan:

### Normal user

```text
Install ECORIONE → Open → Start/auto-start engine → Use
```

User normal tidak perlu tahu Git, Node, pnpm, Docker command, Temporal command, atau service ports.

### Advanced user

Target CLI:

```text
ecorione start
ecorione stop
ecorione status
ecorione restart
ecorione doctor
ecorione update
```

### Developer

Developer workflow tetap boleh menggunakan repo/source tooling (`git`, `pnpm`, development scripts) dan tidak boleh dipaksakan menjadi jalur normal user.

One-line PowerShell dapat menjadi jembatan/early-distribution path, tetapi **bukan tujuan UX final**. Tujuan final adalah installer/launcher yang signed/versioned dengan release artifact yang reproducible.

## 7. Visual freeze boundary

Yang boleh berubah tanpa membuka redesign:

- onboarding wizard;
- provider connection/settings controls;
- service health/status;
- human-readable errors;
- attachment functional state;
- installer/launcher surface;
- accessibility/responsiveness defect fixes.

Yang tidak dikerjakan sekarang kecuali ada alasan produk baru yang kuat:

- redesign sidebar;
- redesign navigation hierarchy;
- theme/color overhaul;
- typography overhaul;
- composer visual overhaul;
- decorative UI refactor tanpa functional value.

## 8. Mandatory update protocol

Setiap pekerjaan Wxx yang dikerjakan harus menambahkan/update entry pada **Execution Log** di bawah sebelum pekerjaan dianggap selesai.

Setiap entry minimal berisi:

- tanggal/waktu;
- Work ID;
- status: `STARTED`, `BLOCKED`, `DONE`, atau `DONE WITH LIMITATIONS`;
- apa yang diubah;
- test/evidence yang dijalankan;
- hasil aktual;
- commit/PR jika ada;
- limitation/defect baru;
- next step.

Jika implementation berbeda dari rencana awal, dokumen ini harus mengikuti **real implementation**, bukan memaksa code agar terlihat cocok dengan rencana lama.

## 9. Execution Log

### 2026-09-14 — W00 — DONE

**Scope:** membuat living work-plan dan aturan dokumentasi wajib.

**Result:**

- visual current ditetapkan sebagai freeze boundary;
- work queue post-Phase-4 dikunci sebagai baseline kerja aktif;
- provider onboarding dan startup/onboarding dimasukkan sebagai pekerjaan produk utama;
- mandatory update protocol ditetapkan: setiap pekerjaan berikutnya wajib memperbarui dokumen ini sebelum dianggap selesai.

**Evidence:** commit yang menambahkan `docs/active-work-plan.md`.

**Limitation:** belum ada implementation item W01–W20 yang dinyatakan selesai oleh entry ini.

**Next:** mulai W01 kecuali operator mengubah prioritas.

### 2026-09-14 — W01 — DONE

**Scope:** reconcile `docs/system-analysis-2026-09-13.md` terhadap current code/evidence.

**Changed:**

- mempertahankan kritik yang masih valid: complexity-vs-use, partial-stack UX, hosted-dollar validation gap, mutable model identity, UX runtime gap, TSX discovery gap, dan attachment UI-only;
- mengoreksi wording backup/restore Sync/Connect: run sebelumnya memiliki absent optional source state, bukan bukti bahwa existing state pasti hilang;
- menghapus status blocker lama yang sudah tidak benar untuk Credential Vault, durable spend ledger, external/public MCP acceptance, dan full-history scanner;
- mempertahankan nuance bahwa history scanner belum menjadi continuous normal-CI gate dan product eval suite masih belum terisi memadai;
- mengarahkan prioritas aktif ke dokumen ini, bukan ke audit historical.

**Evidence:** commit `89592d7ed4c5508e8fa1031bdc9197162ae4ad67` pada branch `agent/active-work-20260914`.

**Result:** `system-analysis-2026-09-13.md` sekarang dapat dibaca sebagai historical analysis yang sudah direconcile, bukan current blocker list yang stale.

**Limitation:** runtime UX dan product-eval gaps yang disebut masih harus ditutup oleh work item berikutnya.

**Next:** W02 — perbaiki Vitest discovery untuk `*.test.tsx` dan verifikasi via CI.

## 10. Claim boundary

Dokumen ini adalah **active execution plan + work log**, bukan bukti bahwa seluruh item sudah selesai. Status `DONE` hanya boleh diberikan setelah implementation/evidence aktual mendukungnya.

Canonical historical evidence dan current-state documents tetap berlaku untuk claim yang sudah ditutup sebelumnya; dokumen ini tidak menghapus evidence lama.