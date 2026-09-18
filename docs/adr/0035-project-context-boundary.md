# ADR-35 — Project adalah context boundary di dalam Workspace

**Status:** Diterima · 2026-09-19 · PE-00

## Konteks

ECORIONE sudah memakai `WorkspaceId` sebagai boundary ownership/authority untuk Flow, Space, MCP, capability, settings, dan runtime lain. `ProjectId` sudah ada di shared IDs, tetapi belum punya domain semantics. Product Evolution membutuhkan grouping Projects tanpa membuat security plane kedua atau mencampur memory antarpoyek.

## Keputusan

1. **Workspace tetap authority/security boundary.** Project selalu berada di tepat satu Workspace dan tidak pernah menaikkan privilege.
2. **Hub memiliki metadata Project**, karena Hub sudah menjadi policy/audit/orchestration control plane. Hub tidak menyalin data owner lain.
3. Default nyata v1:
   - workspace: `ws_personal`;
   - project: `prj_personal`, nama `Personal`.
4. `All` adalah view virtual; tidak ada row `prj_all`.
5. Linkage menggunakan dua pola:
   - direct `project_id` untuk History session, Chat/session context, Context episode/fact/quarantine/core memory, dan Flow graph yang project-owned;
   - Hub `project_bindings` untuk resource shared/optional seperti Artifact, Space page, connector/source, atau Flow reuse pada PE-02.
6. Memory:
   - `project_id IS NULL` = global personal memory;
   - `project_id = prj_x` = memory milik Project itu;
   - retrieval Project = authorized global + current Project only;
   - sibling Projects tidak boleh ikut retrieval.
7. Existing clients boleh sementara menghilangkan `projectId` hanya untuk compatibility Personal. Hub menormalisasi ke `prj_personal` jika request berada pada default/personal workspace. Non-personal workspace tanpa Project gagal jelas.
8. Existing rows dimigrasikan hanya jika klasifikasinya deterministik. Row yang ambigu tetap unassigned/fail-closed sampai direkonsiliasi.
9. Historical Ledger events tetap append-only. Project metadata ditambahkan di level session; event lama tidak ditulis ulang.
10. Project tidak menjadi service baru pada PE-01. Split service hanya boleh lewat ADR baru setelah ada bukti Hub menjadi bottleneck/ownership mismatch.

## Konsekuensi

- Project isolation menjadi predikat wajib di samping scope/sensitivity/syncClass.
- Context `core_memory` perlu evolusi key supaya label yang sama dapat ada secara global dan per Project.
- Flow graph metadata perlu `project_id`, tetapi Temporal tetap execution owner.
- Semua PE batch yang menyentuh data Project wajib negative isolation test A-vs-B.

## Bukan keputusan ini

- Task domain;
- Project sebagai tenant baru;
- cross-workspace Project;
- copy data Artifact/Space/Flow ke tabel Project.
