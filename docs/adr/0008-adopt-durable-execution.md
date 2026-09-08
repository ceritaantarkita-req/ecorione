# ADR-08 — Adopsi mesin durable execution, jangan bangun sendiri

**Status:** Diterima · 2026-09-07 · Sumber: `research.md` §7.3

## Konteks

Agent adalah proses stateful berjalan lama yang membuat efek samping non-idempoten
terhadap sistem eksternal. Tiga kegagalan konkret:

1. **Crash di tengah workflow.** Agent mengirim invoice, proses mati sebelum menulis
   ledger. Saat restart tidak ada catatan — retry menagih dua kali, skip kehilangan catatan.
2. **Efek samping non-idempoten.** Retry naif pada timeout mengirim ulang email.
3. **Menunggu manusia berhari-hari.** Proses tidak bisa menahan thread — atau context
   window — selama tiga hari.

Anthropic menyatakannya langsung: *"minor system failures can be catastrophic for agents"*
karena mereka memegang state lintas banyak tool call.

Lisensi yang diverifikasi: Temporal **MIT**, Trigger.dev **Apache-2.0**, Activepieces
community **MIT**, Windmill **AGPLv3**, Inngest **SSPL**, Restate **BSL 1.1**, dan n8n
**bukan open source OSI** (Sustainable Use License).

## Keputusan

Flow dibangun **di atas** mesin durable execution yang diadopsi. Kandidat: Temporal (MIT)
atau Trigger.dev (Apache-2.0).

Ini infrastruktur yang sudah terpecahkan. Membangunnya sendiri akan memakan seluruh proyek.

## Konsekuensi

- Approval gate adalah **fitur durable state, bukan fitur UI** — LangChain menyatakannya
  eksplisit: *"You must configure a checkpointer to persist the graph state across
  interrupts."*
- Workflow event- dan jadwal-driven saja. **Tidak ada agent polling always-on**: biayanya
  berskala dengan waktu dinding, bukan dengan pekerjaan yang selesai.
- Temporal Agent Harness menarik tapi statusnya sendiri "earlier than public preview" —
  jangan diadopsi sampai stabil.
