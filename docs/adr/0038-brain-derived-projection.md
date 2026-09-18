# ADR-38 — Brain adalah rebuildable authorized projection, bukan graph source-of-truth

**Status:** Diterima · 2026-09-19 · PE-00

## Konteks

Product membutuhkan Brain graph untuk melihat hubungan Project, conversation, memory, source, Flow, Trigger, Run, dan entity. ADR-05 sudah menolak graph database sebagai default dan owner boundaries melarang cross-service DB read.

## Keputusan

1. Brain v1 adalah **derived graph projection**.
2. Tidak ada Neo4j/FalkorDB atau graph service/database baru pada PE-06.
3. Implementasi awal berupa package/query layer yang membaca **owner APIs/contracts**, bukan DB owner lain.
4. V1 tidak membutuhkan persistent Brain cache. Jika performa membuktikan perlu, cache harus rebuildable SQLite-derived dan memerlukan review.
5. Deterministic edges dibangun dulu dari IDs/provenance/bindings:
   - Project <- session;
   - Trigger -> Flow;
   - Run/operation -> Trigger/Flow;
   - Memory -> source Episode;
   - Artifact/Space/source -> Project binding;
   - supersede/provenance relations.
6. LLM/entity extraction tidak menjadi syarat Brain V1 dan tidak boleh menciptakan canonical edge.
7. Authorization terjadi **sebelum** node/edge dikembalikan. Redacting content saja tidak cukup karena existence/relationship dapat sensitif.
8. Brain Project query tidak boleh mengungkap sibling Project.
9. Brain tidak menggantikan Context retrieval atau ECX selector:
   `Project -> Brain neighborhood -> Context retrieval -> ECX -> context pack`.
10. Brain projection harus bisa dihapus dan dibangun ulang tanpa data loss.

## Konsekuensi

- PE-06 wajib privacy/isolation regression tests.
- PE-07 hanya memakai Brain untuk candidate narrowing dan harus mengukur manfaatnya sebelum menambah graph complexity.
