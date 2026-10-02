# ADR-40 — MCP action binding tetap Flow → Connect-governed

**Status:** Diterima · 2026-10-02 · Session 11

## Konteks

Session 9–10 membuat automation non-time dapat dipicu oleh event, webhook, dan deterministic condition. Flow sudah memiliki node `mcp-tool` dan Connect sudah memiliki outbound MCP manager dengan workspace isolation, credential references, Hub governance, dan durable idempotency. Namun konfigurasi MCP Tool di Flow masih bergantung pada raw JSON sehingga use case seperti aksi email/Telegram melalui MCP server yang sudah dikonfigurasi belum menjadi product path yang layak.

Menambah native Gmail/Telegram service atau autonomous runtime baru akan menduplikasi transport, credential, policy, dan retry authority yang sudah dimiliki Connect/Flow.

## Keputusan

1. **Flow tetap pemilik graph/action composition.** Automation Trigger hanya menunjuk exact pinned Flow version.
2. **Connect tetap satu-satunya outbound MCP runtime/credential boundary.** Tidak ada browser-direct MCP transport.
3. Ai boleh mengekspos product-only MCP action catalog untuk Flow dengan dua operasi bounded:
   - list server yang sudah terdaftar untuk Workspace;
   - explicit user-initiated tool discovery pada satu server.
4. Browser product route tidak boleh mengekspos MCP tool-call endpoint.
5. Discovery request dari browser tidak boleh memilih autonomy atau operation identity. Ai membuat operation id sendiri dan memaksa discovery menjadi **L0 READ** sebelum Connect/Hub governance.
6. Tool discovery tidak otomatis mengaktifkan tool. Hanya Connect registry policy yang menentukan `enabled` dan `actionClass`.
7. Flow MCP Tool quick settings memakai server/tool hasil owner discovery sebagai picker, tetapi graph tetap menyimpan hanya `serverId`, `tool`, dan `arguments`; tidak ada raw credential di graph.
8. MCP Tool `arguments` boleh memakai bounded template dari input node:
   - embedded string template seperti `Reply to {{ sender.email }}` menghasilkan string;
   - exact template seperti `{{ payload }}` mempertahankan tipe nilai asli;
   - recursive rendering dibatasi depth dan jumlah elemen;
   - tidak ada `eval`, dynamic function, atau arbitrary expression language.
9. Resolved arguments dihitung Flow tepat sebelum dispatch dan dikirim ke Connect. Connect tetap melakukan governance terhadap **actual resolved arguments** dan tetap menjadi owner idempotency/uncertain-outcome semantics.
10. External side effect tetap tunduk pada action class, approval/policy, capability authority, sensitivity, dan autonomy yang sudah ada. Product picker tidak memberi execution grant.
11. Provider-specific Gmail/Telegram adapter, OAuth onboarding, event subscription, dan provider-specific reply semantics tetap scope terpisah. MCP server pihak ketiga dapat dipakai bila operator sudah mengonfigurasinya sesuai ADR-23.

## Konsekuensi

- Flow tidak lagi mengharuskan user menghafal MCP server/tool id untuk action node.
- Event/condition automation dapat meneruskan data runtime ke external MCP action secara terstruktur tanpa membuat service autonomous baru.
- Tool yang disabled tetap tidak executable meskipun pernah ditemukan.
- Browser discovery dapat membuka koneksi outbound hanya setelah tindakan user dan tetap melalui Hub READ governance.
- Runtime side effect tidak dapat dijalankan dari endpoint discovery.

## Non-goals

Session 11 tidak:

- membuat native Gmail atau Telegram connector;
- menyimpan OAuth token baru di graph/browser;
- menambah polling inbox/chat;
- membuat Task domain atau autonomous daemon;
- mengaktifkan L4 / AutoClick;
- menambah second scheduler/queue/credential store/policy authority;
- melakukan production cutover.
