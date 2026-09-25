# Session 9 — A-08 remainder closure decision

Date: **2026-09-26**

Status: **A-08 CLOSED / REMAINDER EXPLICITLY DEFERRED**

## Decision

The two remaining A-08 candidates were audited against current owner contracts on exact main `1cdb39f297702441ed1c2d42f92b69e20f9e0097`.

Neither candidate currently satisfies the owner-identity rule required for a safe Brain expansion, so both are explicitly deferred rather than implemented with synthetic identities or inferred relationships.

This closes A-08 at the currently proven owner-backed boundary.

## 1. Connector/resource hierarchy — DEFERRED

Current Connect/MCP resource discovery exposes:

```text
uri
name?
description?
mimeType?
```

The `uri` is a stable resource identity for an advertised/readable MCP resource and is already authorization-checked before resource read. However, the current ECORIONE Connect contract does **not** expose a canonical hierarchy relationship such as:

```text
parentUri
children
contains
folderId
parentResourceId
```

and the Hub Project-source browse contract forwards the same flat resource view.

Therefore:

- Brain must not infer folder/parent relationships from URI string shape, slashes, prefixes, provider-specific naming, or display names;
- Brain must not mirror an external filesystem merely for visualization;
- a connector resource may still be explicitly browsed/read/snapshotted through the existing governed source flow;
- snapshot bytes remain Artifact-owned and can already appear through authorized Artifact/Source projection after ingestion.

Reopen condition: a connector/provider contract must expose a stable authorized parent/child identity or relationship directly, and Connect must preserve that owner-backed relationship through its typed boundary.

## 2. Core Memory representation — DEFERRED

Current Context storage supports global and Project-specific Core Memory blocks. Storage uniqueness is:

```text
global:  label where project_id IS NULL
project: (project_id, label)
```

and the Context API exposes Core Memory blocks with `label`, optional `projectId`, description/value/classification fields, and updates through `/v1/core-memory/:label`.

However, unlike Fact, Artifact, Page, Flow, Trigger, Run, and Project entities, `CoreMemoryBlockSchema` exposes **no canonical ID field**.

The current `(projectId, label)` storage key is sufficient for Context lookup/update semantics, but the A-08 Brain rule explicitly forbids inventing a Brain canonical identity from labels/text. Creating an ID such as `core-memory:<project>:<label>` inside Brain would make Brain the identity inventor rather than Context the owner.

Therefore Core Memory is not promoted to a first-class Brain node in this scope.

Reopen condition: Context must explicitly own and expose a stable canonical Core Memory block identity in its shared/API contract, with migration/backward-compatibility semantics defined by Context itself.

## 3. What remains unchanged

- Brain remains a deterministic, rebuildable read projection.
- Existing Source, Artifact, Page, Flow, Trigger, Run, Fact, Project nodes remain canonical-owner-backed.
- A-08c Fact -> Artifact `GENERATED_FROM` remains exact and owner-backed.
- A-08d selected-node grounded assistant remains on the existing Ai -> Hub -> Context -> Connect path.
- No connector folder tree is synthesized.
- No Core Memory ID is synthesized.
- No graph database, second chat system, second memory store, or owner mutation is introduced.
- No hosted-provider spend, DR-2 work, or production cutover is opened.

## 4. A-08 closure

A-08 sequence is now closed at the safe implemented boundary:

- A-08a — owner-backed Artifact/Page projection — CLOSED / PASS
- A-08b — Context Fact projection — CLOSED / PASS
- A-08c — exact Fact provenance to authorized Artifact — CLOSED / PASS
- A-08d — embedded selected-node grounded Brain assistant — CLOSED / PASS
- connector/resource hierarchy — DEFERRED pending owner-backed hierarchy identity
- Core Memory representation — DEFERRED pending Context-owned canonical block identity

A-09 and A-10 are now eligible for separate explicit selection. This document does **not** automatically open either scope.

## Safe resume rule

If either deferred feature is revisited:

1. verify current main and open PRs first;
2. inspect the current owner contract rather than assuming this 2026-09-26 limitation still applies;
3. require owner-exposed canonical identity/relationship before Brain projection;
4. keep authorization fail-closed before projection;
5. add deterministic tests and rendered acceptance for any user-visible Brain change;
6. do not infer identity from labels, text, URI shape, or provider-specific path conventions.
