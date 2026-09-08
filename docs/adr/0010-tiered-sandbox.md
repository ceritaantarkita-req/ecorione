# ADR-10 — Sandbox bertingkat; tidak mengklaim "secure sandbox"

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §6

## Konteks

Target Windows 11 Home, 8–16GB RAM. Yang gugur setelah verifikasi: **Firecracker** dan
**gVisor** (butuh Linux+KVM), **E2B** (self-host hanya GCP/AWS — dependensi cloud),
**Windows Sandbox** dan Hyper-V containers (**tidak tersedia di Windows Home**),
**Daytona** (repo publik tidak dipelihara sejak Juni 2026), **microsandbox** (satu-satunya
jalur microVM native Windows, tapi self-declared beta).

Threat model yang jujur, berurutan menurut probabilitas nyata:

1. AI menulis kode buggy yang merusak data pengguna — **paling mungkin terjadi**
2. Indirect prompt injection
3. Supply chain (`pip install` paket typosquat)
4. ~~Escape kernel oleh aktor negara~~ — bukan threat model ini

**Poin 1–3 hampir tidak terpengaruh** oleh pilihan microVM vs container. MicroVM tidak
mencegah agent menghapus dokumen yang di-mount ke dalamnya.

## Keputusan

Tiga tingkat:

- **Tier 0** — selalu menyala, biaya nol: allowlist filesystem, deny-list verb destruktif,
  allowlist egress, konfirmasi manusia untuk aksi tak-terbalikkan, semua masuk audit log,
  workspace di bawah version control supaya "undo" ada.
- **Tier 1.5 (default)** — WASM (Wasmtime/Pyodide) untuk transformasi data. Nol ambient
  authority, start <100ms, **native Windows tanpa WSL2 dan tanpa pajak memori Docker
  Desktop (1–3GB)**.
- **Tier 1 (eskalasi)** — Docker+WSL2 untuk yang butuh paket nyata atau jaringan.
  `--network=none` default, `--read-only`, `--cap-drop=ALL`, `no-new-privileges`, user
  non-root, batas memori/CPU/PID, **tidak pernah mount docker socket**, satu bind mount.

**ecorione tidak mengklaim "secure sandbox"**, dan itu dinyatakan di dokumentasi.

## Konsekuensi

- Yang diklaim: mencegah kecelakaan dan paket buruk kasual. Yang tidak: eksploitasi kernel
  yang ditentukan.
- "Sandbox WASM" tidak otomatis aman — escape biasanya lewat **host binding yang kita
  tambahkan sendiri**, bukan lewat engine-nya.
- **Tingkat sandbox nyaris tidak berarti kalau AutoClick berjalan tanpa batas** (ADR-11).
