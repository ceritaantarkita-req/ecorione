# W11 operator attempt 4 — 2026-09-16

Status: FAIL / production packaging defect identified.

The rebuilt installer from source revision `45ab54d233f28a71ea5eba6b396b592ce4a42e2a` passed:

- installer SHA-256 verification;
- isolated Setup installation;
- host Node/pnpm/Git isolation;
- installed Doctor pre-start;
- Docker image load and Compose startup far enough for the Ai endpoint to become ready on fallback port `17029`.

The formal acceptance then failed because service `context` was not running. Direct container inspection showed a restart loop with exit code `1` and the repeated production error:

`ENOENT: no such file or directory, scandir '/app/services/context/dist/migrations/'`

Root cause: `services/context/package.json` defines a build step that copies SQL migrations from `src/migrations/` to `dist/migrations/`, but the repository root production build only ran `tsc --build` and the Ai build. The Context package asset-copy step therefore never ran when the Docker image used by the desktop installer was produced.

Disposition:

- expose Context runtime-asset copying as an explicit package script;
- require the repository root production build to invoke it;
- fail the Docker image build if compiled Context migration SQL assets are absent;
- add regression coverage for the production asset contract;
- rebuild the desktop installer before the next W11 operator attempt.

This failure is unrelated to local-model inference latency: Context crashes before serving because its SQL migration assets are missing from the production image.
