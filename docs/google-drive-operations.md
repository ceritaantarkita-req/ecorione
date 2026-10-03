# ECORIONE — Native Google Drive Operations

Last updated: **2026-10-03**

Status: **SESSION 12D LOCAL ACCEPTANCE SUPPORT / NO REMOTE STAGING REQUIRED**

This runbook covers operator configuration and bounded local acceptance for Native Google Drive. It does not authorize whole-Drive indexing, recursive sync, production cutover, DR-2 proof, or a new connector roadmap.

## Architecture boundary

```text
Browser
  -> Ai same-origin /api/integrations/google-drive/*
  -> Connect OAuth + encrypted Vault custody
  -> Google OAuth / Picker / Drive API

selected file IDs only
  -> Connect governed fetch/export
  -> Hub Project Source lifecycle
  -> Artifact snapshot
  -> Context Index/Re-index on explicit user action
```

Refresh tokens remain in Connect Vault. The browser receives only a short-lived Picker access token through a `no-store` Ai proxy and must not persist it in localStorage, sessionStorage, or IndexedDB.

The OAuth scope remains fixed to:

```text
https://www.googleapis.com/auth/drive.file
```

## Google Cloud prerequisites

Use one operator-controlled Google Cloud project for this acceptance.

Required setup:

1. enable **Google Drive API**;
2. enable/configure **Google Picker API**;
3. configure the Google OAuth consent screen / Google Auth platform;
4. create an OAuth client appropriate for the web callback;
5. register this exact local redirect URI:

```text
http://localhost:3000/api/integrations/google-drive/callback
```

6. create an API key for Google Picker;
7. restrict the API key rather than leaving it unrestricted;
8. when using website/referrer restrictions, allow the local app origin and the Google Picker iframe origin required by Google Picker;
9. record the numeric **Google Cloud project number**; this is the Picker App ID and is not the OAuth client ID.

For the standard local acceptance in this runbook, use `http://localhost:3000`. Do not mix `localhost`, `127.0.0.1`, or another port between the Google Cloud redirect registration, ECORIONE env, and the browser origin.

## Local env

Never commit `.env`, OAuth client secret, Vault master key, refresh token, access token, or real API key.

If needed:

```powershell
Copy-Item .env.example .env
```

Generate a Connect Vault key locally:

```text
pnpm --filter @ecorione/connect vault:keygen
```

Copy the generated value into the local `.env` only.

Required Session 12D local fields:

```dotenv
ECORIONE_CONNECT_VAULT_MASTER_KEY=<32-byte-base64url-key>

ECORIONE_GOOGLE_DRIVE_CLIENT_ID=<google-oauth-client-id>
ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET=
ECORIONE_GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/integrations/google-drive/callback

ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY=<restricted-picker-api-key>
ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID=<numeric-cloud-project-number>
```

`ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET` is optional at the ECORIONE runtime contract. If the selected OAuth client setup supplies/requires one, keep it only in local/operator secret custody.

The Picker API key is intentionally delivered to the browser by the short-lived Picker session. It is not a replacement for OAuth and must still be restricted in Google Cloud.

## Preflight

Run before starting OAuth:

```text
pnpm acceptance:google-drive:preflight -- --origin http://localhost:3000
```

The command reads `.env` and fails closed if:

- Connect Vault master key is not canonical 32-byte base64url;
- OAuth client ID is absent/invalid at the repository contract;
- configured client secret is malformed;
- redirect URI is unsafe;
- redirect origin differs from the expected Ai origin;
- redirect path is not exactly `/api/integrations/google-drive/callback`;
- Picker developer key is absent/malformed;
- Picker App ID is not a numeric Cloud project number.

PASS output is non-secret. It reports only configuration state and redirect origin/path.

The preflight cannot prove that Google Cloud APIs, consent-screen audience/test users, OAuth redirect registration, or API-key restrictions are correctly configured. Those remain real Google-side acceptance conditions.

## Start the local runtime

The standard acceptance path uses `pnpm dev`, not `pnpm dev:phase4`, because the root `dev` command explicitly loads `.env`.

If Temporal is not already reachable and Temporal CLI is unavailable, start the pinned local Temporal/PostgreSQL pair first:

```text
docker compose -f deploy/local-temporal.yml up -d
```

Then:

```text
pnpm dev
```

Expected local service ports include:

```text
RnD       17021
Context   17022
Connect   17023
Hub       17024
Artifact  17025
Space     17027
Flow      17028
Temporal   7233
Ai         3000  (Next dev)
```

Do not claim PASS if another process silently changes the Ai origin/port. The configured OAuth redirect must match the browser origin exactly.

## Mock acceptance before real Google

Before using any real Google credential, run:

```text
pnpm acceptance:google-drive:mock
```

This deterministic suite uses synthetic credentials and mocked Google/owner endpoints. It exercises:

- disconnected -> OAuth start/callback -> connected status;
- encrypted refresh-token custody and one-time OAuth state;
- short-lived Picker session without refresh-token disclosure;
- reconnect-required when Google rejects the stored refresh token;
- explicit blob-file download;
- deterministic Google-native document export;
- Google Drive -> Hub -> Artifact Project Source ingestion;
- same-origin refresh to a new Artifact;
- lifecycle reset from `INDEXED` to `SNAPSHOT_READY` when the snapshot changes;
- idempotent retry of the refreshed operation;
- disconnect/revoke semantics;
- callback/Picker browser proxy and source-contract security tests.

Mock acceptance does not prove Google Cloud console configuration, consent audience, real OAuth exchange, Picker iframe rendering, or real Drive permission behavior. Those remain part of the operator local acceptance below.

## Session 12D acceptance journey

Use the Personal Workspace Project Sources surface.

1. Verify Google Drive shows configured but disconnected.
2. Select **Hubungkan Google Drive**.
3. Verify browser navigation goes only to the Google authorization origin.
4. Complete consent and confirm callback returns to the same ECORIONE origin/Project path.
5. Repeat once with consent cancelled and confirm safe return with no leaked Google error detail.
6. Verify connected status and **Picker siap**.
7. Open **Pilih file Drive**.
8. Select at least:
   - one normal stored/blob file; and
   - one supported Google-native file that exercises export.
9. Confirm only explicitly selected files are ingested.
10. Confirm each selected file becomes an Artifact-backed Project Source with `sourceType=google-drive` and concrete Google file ID lifecycle identity.
11. Run Index, then Re-index, through the existing Project Source lifecycle.
12. Use **Refresh Drive snapshot** and confirm lifecycle `latestArtifactId` advances when content changes.
13. Disconnect Google Drive.
14. Confirm Connect credential custody is removed/revoked while already-created Artifact snapshots remain available.
15. Inspect browser storage and confirm no Google refresh/access token is persisted.

## Fail-closed cases to observe

Do not work around these failures by broadening scope or weakening security:

- `GOOGLE_DRIVE_NOT_CONFIGURED`;
- `GOOGLE_DRIVE_PICKER_NOT_CONFIGURED`;
- `GOOGLE_DRIVE_NOT_CONNECTED`;
- `GOOGLE_DRIVE_RECONNECT_REQUIRED`;
- missing refresh token after OAuth;
- invalid/expired one-time OAuth state;
- unsafe or cross-origin return path;
- unsupported/oversized selected file;
- Google upstream timeout/rate/error response.

## Evidence capture

Record only sanitized evidence:

- exact Git branch/head;
- preflight PASS;
- local service health;
- connected/disconnected state;
- selected file MIME/category, not private file contents;
- Artifact/lifecycle IDs when safe;
- Index/Re-index/Refresh outcomes;
- browser-storage token-persistence check;
- disconnect outcome.

Do **not** record:

- OAuth authorization code;
- PKCE verifier/state;
- access/refresh token;
- API key value;
- OAuth client secret;
- Vault master key;
- private Google file contents.

## Teardown

Stop ECORIONE with Ctrl+C.

If local Temporal was started through the Compose helper:

```text
docker compose -f deploy/local-temporal.yml down
```

Do not add `-v` unless intentionally deleting local Temporal persistence.

## Acceptance boundary

A successful run proves Session 12D behavior on operator-controlled local compute.

It does **not** prove:

- remote staging;
- production;
- Cloudflare/public edge;
- DR-2 physical independence;
- whole-Drive sync;
- multi-user Workspace/RBAC;
- universal Google Workspace connector coverage.

After local PASS, record sanitized evidence, update PR #444 to the exact accepted head, merge only that reviewed head, and require merged-main repository gates.
