# ECORIONE — Active Work Plan

Last updated: **2026-09-18**

Status: **NO ACTIVE ITEM / previous baseline closed**

This document intentionally excludes closed chronology. Exact historical evidence remains in `docs/verification/`.

## Active item

**None.**

The previously defined implementation/hardening plan is closed at its documented boundaries:

- Batch 1–12: **CLOSED**;
- W03/W09/W10/W11/W16/W17/W18/W20: **CLOSED at documented boundaries**;
- F6-E01 through F6-E08: **CLOSED / REPO-SIDE PASS**.

## Latest closure — F6-E08

F6-E08 immutable container-image identity closed through PR #164.

Exact reviewed head:

```text
6c46944108cdc275aebc682bd132ec9dc69e14e4
```

Acceptance:

```text
CI #1114                         PASS
Product Eval #353               PASS
MCP External HTTPS #528         PASS
Desktop Installer #70           PASS
merged main                     cacffa6c59d6871ae1ab4e11ae17cd48847864c1
```

The new `images:digest-review` policy is wired into normal CI and release-security acceptance. Governed external Node/Postgres/Temporal/Caddy images remain readable-tag + immutable-digest pinned.

## Deferred by decision

- compute-host/VPS + Cloudflare activation — **DEFERRED BY OPERATOR**;
- AutoClick — **DEFERRED BY DESIGN**.

These are not blockers to closure of the existing repository baseline.

## Future work

Projects / Work / Schedule / Brain remain discussion material only. They are **not an active roadmap yet**.

Before implementation resumes, create a new explicit scope/roadmap after architecture discussion. Do not implicitly continue F6 or create Batch 13.
