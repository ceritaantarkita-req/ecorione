# ECORIONE — GitHub Codespaces development

Status: **DEVELOPMENT PROFILE ONLY**

This profile provides an online development computer for ECORIONE without changing the existing service-ownership model or turning Codespaces into production/staging infrastructure.

## Boundary

Codespaces is only a development environment.

It does **not** prove production readiness, remote staging verification, DR-2 physical independence, durable production storage, multi-user identity/RBAC, or safe public exposure of internal ECORIONE services.

The runtime remains the existing ECORIONE architecture. The profile only supplies Node/pnpm, Docker, the existing local Temporal Compose stack, and one forwarded Ai preview port.

## What starts automatically

When a Codespace is created:

1. Node **22.20.0** and pnpm **10.28.0** are installed.
2. `pnpm install --frozen-lockfile` runs.
3. `.env.example` is copied to local gitignored `.env` only if `.env` does not already exist.
4. Docker-in-Docker is available for the existing repository Compose tooling.

When a Codespace starts or resumes, `deploy/local-temporal.yml` is started with Docker Compose and Temporal stays on loopback port `7233`. The application itself is not started as an unattended background process.

Start ECORIONE with:

```bash
bash .devcontainer/start.sh
```

That reuses the existing root `pnpm dev` path and therefore keeps the current service bootstrap behavior.

## Preview

The only port configured for automatic forwarding is `3000`, labeled **ECORIONE Ai preview**.

Codespaces forwarded ports are private by default. Keep the preview private for normal development.

For a temporary shared visual review, port 3000 may be made public from the Codespaces **Ports** panel or with GitHub CLI:

```bash
gh codespace ports visibility 3000:public
```

A public forwarded port is reachable by anyone who knows the URL. Use public visibility only for a bounded review session, keep hosted-provider credentials disabled or dummy where possible, preserve the hosted cost kill switch, and return the port to private afterward:

```bash
gh codespace ports visibility 3000:private
```

Do not expose ports 17010–17028, 7233, databases, Connect Vault files, or MCP internals publicly.

## Credentials and runtime data

Never commit `.env`, provider API keys, OAuth credentials, Vault material, or runtime databases.

Treat a Codespace as disposable development compute. Gitignored runtime data and nested Docker volumes are useful for development continuity but are not a production persistence or backup boundary.

## Native Google Drive caveat

The current Session 12 local acceptance contract uses an exact localhost OAuth redirect URI. A Codespaces preview URL has a different HTTPS origin.

Therefore this profile does **not** silently change the Google OAuth/Picker contract. Real Session 12D Google OAuth + Picker acceptance continues to use the existing local acceptance runbook until a separate, explicit Codespaces-safe redirect/origin adaptation is designed and accepted.

## Useful commands

Start/restart Temporal:

```bash
docker compose -f deploy/local-temporal.yml up -d --wait --wait-timeout 90
```

Inspect Temporal containers:

```bash
docker compose -f deploy/local-temporal.yml ps
```

Stop Temporal:

```bash
docker compose -f deploy/local-temporal.yml down
```

Start ECORIONE:

```bash
bash .devcontainer/start.sh
```

Run repository verification:

```bash
pnpm verify
```

## Intended workflow

```text
GitHub branch / PR
        |
        v
GitHub Codespaces
        |
        +--> existing ECORIONE services
        +--> existing Temporal dev stack
        |
        v
private port 3000 preview
        |
        +--> temporary public visibility only when a shared live review is needed
```

This profile is intentionally additive. It does not replace local development, the self-host path, or a future persistent staging target.
