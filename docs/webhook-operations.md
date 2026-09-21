# Webhook operations

Last updated: **2026-09-21**

Status: **PE-05 OPERATIONAL CONTRACT**

PE-05 exposes a generic verified webhook ingress through Connect. Connect authenticates external delivery and forwards only verified payloads to Flow. Flow resolves the configured webhook Trigger, applies Project/Flow validation and Hub policy, deduplicates delivery, and starts the exact pinned Flow through Temporal.

## Ownership

```text
External sender
  -> Connect public webhook ingress
     -> per-hook token verification
     -> Flow internal webhook ingress
        -> Trigger selector + Project boundary
        -> Hub policy
        -> Temporal Flow
        -> Run/audit/trace evidence
```

- Connect owns the webhook root secret.
- Flow stores only non-secret `hookId`, source/kind selector, Trigger metadata, and bounded dedupe receipts.
- Hub remains policy/approval/capability/audit owner.
- Temporal remains execution/retry/recovery owner.

Do not put the webhook root secret or derived token in Trigger configuration, docs, source code, or logs.

## Configure the root secret

Production/self-host uses the existing encrypted Connect Vault. Store the credential under:

```text
provider = webhook
purpose  = tokens
```

The existing protected control route can set it:

```text
PUT /v1/settings/credentials/webhook
Authorization: Bearer <internal token>
Content-Type: application/json

{"secret":"<strong random root secret>"}
```

When the encrypted vault is active, the development environment fallback is ignored.

Local development may use `ECORIONE_WEBHOOK_ROOT_SECRET`. It must not be committed.

## Create a webhook Trigger

Create the Trigger through the normal Flow Trigger API with an exact pinned graph version:

```json
{
  "workspaceId": "ws_personal",
  "projectId": "prj_personal",
  "name": "Repository push",
  "kind": "webhook",
  "graphId": "fg_example",
  "graphVersion": 1,
  "versionPolicy": "PINNED",
  "requestedAutonomy": "L2",
  "enabled": true,
  "configuration": {
    "adapter": "generic",
    "hookId": "hook_example_0001",
    "source": "github",
    "eventKind": "push"
  }
}
```

`hookId` is public routing metadata, not a credential, and must be unique.

## Obtain the per-hook token

The root secret is never returned. An authenticated operator can request a deterministic token scoped to one `hookId`:

```text
GET /v1/settings/webhooks/<hookId>/token
Authorization: Bearer <internal token>
```

The response contains the derived per-hook token. Rotating the root secret rotates all derived tokens.

## Deliver a webhook

External delivery goes to Connect:

```text
POST /v1/webhooks/<hookId>
X-ECORIONE-Webhook-Token: <derived token>
Content-Type: application/json
```

Body:

```json
{
  "deliveryId": "provider-stable-delivery-id",
  "occurredAt": "2026-09-19T10:20:00.000Z",
  "payload": {},
  "metadata": {}
}
```

`deliveryId` must be stable across provider retries. The same Trigger + delivery identity resolves to one logical dispatch. Reuse with conflicting normalized event content fails closed.

## Limits and safety

- public webhook HTTP body is capped before application parsing;
- normalized payload is capped at 64 KiB;
- metadata is capped at 16 KiB;
- missing/wrong token is rejected before forwarding to Flow;
- verified Connect -> Flow forwarding is timeout-bounded to 10 seconds by default; transport/timeout failure returns a sanitized `502 UPSTREAM_UNAVAILABLE`;
- disabled Trigger does not dispatch;
- Workspace/Project is derived from the Trigger for public webhook delivery, not accepted from the caller;
- exact pinned Flow version is validated before execution;
- external payload is untrusted data and cannot grant capability or autonomy;
- external-send, spend, credential, irreversible-write, and policy-admin gates remain unchanged;
- no polling daemon, second queue, second scheduler, or always-on LLM monitor is introduced.

## Retry / recovery

If Connect returns `502 UPSTREAM_UNAVAILABLE` because Flow forwarding timed out, retry the provider delivery with the **same** stable `deliveryId`. The first attempt may have reached Flow before the response path failed; reusing the same identity lets Flow dedupe resolve both attempts to one logical dispatch.

Flow reserves a bounded dedupe receipt as `PENDING` before Temporal start, then marks it `STARTED` after the deterministic workflow identity exists. A process restart between those steps can safely resume against the same workflow identity instead of creating another logical execution.

Temporal owns Flow runtime retry/recovery. The webhook receipt is not a work queue or execution source of truth.
