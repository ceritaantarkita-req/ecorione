# ADR-15 — Lisensi MIT; hindari sumber AGPL

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §1

## Konteks

Repo akan dipublikasikan. Ekosistem sekitarnya hampir seragam MIT: deepseek-harness,
kimi-code, Aider, Cline, CrewAI, promptfoo, Temporal.

Yang perlu dihindari saat mempelajari atau memfork kode orang lain:

- **AGPL-3.0** — copyleft-nya menjangkau penggunaan lewat jaringan: basic-memory, Skyvern,
  Windmill.
- **Bukan open source OSI** — n8n (Sustainable Use License), Inngest (SSPL), Restate (BSL 1.1).
- **Batas kabur** — LiteLLM: issue #34241 mendokumentasikan ~19 fitur yang dipasarkan
  Enterprise tapi **nol import** dari direktori enterprise (jadi MIT menurut LICENSE-nya
  sendiri), dan ~8 yang cuma digerbang di frontend. **Jangan bangun produk di atas asumsi
  sebuah fitur LiteLLM akan tetap MIT** — ambil `model_prices_and_context_window.json`
  (tabel harga publik terbaik yang ada, MIT) dan SDK-nya, jangan jalankan proxy-nya.

## Keputusan

Lisensi MIT. Wajib ada `LICENSE`, `CONTRIBUTING.md`, dan `AGENTS.md` sebelum publish.

Sebelum go-public: secret scan atas **seluruh history**, bukan cuma working tree, dan
review `.gitignore`. Tidak menyalin script VPS/infra privat dari ekosistem lama.

## Konsekuensi

Ide boleh dipelajari dari sumber AGPL; kodenya tidak disalin.
