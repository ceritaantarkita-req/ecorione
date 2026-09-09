import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { openHubDatabase, type HubDatabase } from "./db.js";
import { buildHubServer } from "./http.js";

const DIGEST_A = "a".repeat(64);
const DIGEST_B = "b".repeat(64);
const ARTIFACT_A = `art_${DIGEST_A}`;
const ARTIFACT_B = `art_${DIGEST_B}`;

function manifest(version = "1.0.0", digest = DIGEST_A) {
  return {
    apiVersion: "ecorione.extension/v1",
    id: "demo.ext",
    name: "Demo Extension",
    version,
    description: "Extension lifecycle test fixture.",
    source: {
      type: "github",
      repository: "example/demo-extension",
      commitSha: version === "1.0.0" ? "1".repeat(40) : "2".repeat(40),
      bundleSha256: digest,
    },
    packageArtifactId: `art_${digest}`,
    execution: { kind: "none" },
    capabilities: [],
    permissions: [],
    secretRequirements: [],
  };
}

function context(operationId: string, idempotencyKey: string) {
  return {
    operationId,
    workspaceId: "ws_alpha",
    scope: "personal",
    sensitivity: "INTERNAL",
    autonomy: "L1",
    idempotencyKey,
  };
}

let db: HubDatabase;
let app: FastifyInstance;

beforeEach(() => {
  db = openHubDatabase();
  app = buildHubServer(db, {
    contextUrl: "http://context.local",
    connectUrl: "http://connect.local",
    rndUrl: "http://rnd.local",
  });
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe("extension HTTP lifecycle", () => {
  it("validates without installing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/extensions/validate",
      payload: { manifest: manifest() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().allowed).toBe(true);
    expect(db.raw.prepare("SELECT count(*) AS n FROM extension_revisions").get()).toEqual({
      n: 0,
    });
  });

  it("installs idempotently and isolates workspace visibility", async () => {
    const payload = { ...context("op_install_a", "install-key-a"), manifest: manifest() };
    const first = await app.inject({ method: "POST", url: "/v1/extensions/install", payload });
    expect(first.statusCode).toBe(201);
    expect(first.json().deduplicated).toBe(false);

    const retry = await app.inject({ method: "POST", url: "/v1/extensions/install", payload });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().deduplicated).toBe(true);

    const own = await app.inject({ method: "GET", url: "/v1/extensions?workspaceId=ws_alpha" });
    expect(own.statusCode).toBe(200);
    expect(own.json().extensions).toHaveLength(1);

    const other = await app.inject({
      method: "GET",
      url: "/v1/extensions?workspaceId=ws_beta",
    });
    expect(other.statusCode).toBe(200);
    expect(other.json().extensions).toEqual([]);
  });

  it("rejects conflicting reuse of an idempotency key", async () => {
    const first = {
      ...context("op_install_b", "same-key-conflict"),
      manifest: manifest("1.0.0", DIGEST_A),
    };
    expect(
      (await app.inject({ method: "POST", url: "/v1/extensions/install", payload: first }))
        .statusCode,
    ).toBe(201);

    const conflicting = {
      ...context("op_install_c", "same-key-conflict"),
      manifest: { ...manifest("1.0.0", DIGEST_B), packageArtifactId: ARTIFACT_B },
    };
    const res = await app.inject({
      method: "POST",
      url: "/v1/extensions/install",
      payload: conflicting,
    });
    expect(res.statusCode).toBe(409);
  });

  it("updates, rolls back by creating a new revision, reports health, then removes", async () => {
    const installed = await app.inject({
      method: "POST",
      url: "/v1/extensions/install",
      payload: { ...context("op_install_d", "install-key-d"), manifest: manifest() },
    });
    expect(installed.statusCode).toBe(201);
    const firstRevision = installed.json().revision.revisionId as string;

    const updated = await app.inject({
      method: "POST",
      url: "/v1/extensions/demo.ext/update",
      payload: {
        ...context("op_update_d", "update-key-d"),
        manifest: manifest("2.0.0", DIGEST_B),
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().extension.currentRevision.manifest.version).toBe("2.0.0");

    const rolledBack = await app.inject({
      method: "POST",
      url: "/v1/extensions/demo.ext/rollback",
      payload: {
        ...context("op_rollback_d", "rollback-key-d"),
        targetRevisionId: firstRevision,
      },
    });
    expect(rolledBack.statusCode).toBe(200);
    expect(rolledBack.json().extension.currentRevision.manifest.version).toBe("1.0.0");
    expect(rolledBack.json().revision.sourceRevisionId).toBe(firstRevision);

    const revisions = await app.inject({
      method: "GET",
      url: "/v1/extensions/demo.ext/revisions?workspaceId=ws_alpha",
    });
    expect(revisions.statusCode).toBe(200);
    expect(revisions.json().revisions).toHaveLength(3);

    const health = await app.inject({
      method: "POST",
      url: "/v1/extensions/demo.ext/health",
      payload: {
        ...context("op_health_d", "health-key-d"),
        status: "HEALTHY",
        detail: "runtime reachable",
      },
    });
    expect(health.statusCode).toBe(200);
    expect(health.json().extension.healthStatus).toBe("HEALTHY");

    const removed = await app.inject({
      method: "POST",
      url: "/v1/extensions/demo.ext/remove",
      payload: {
        ...context("op_remove_d", "remove-key-d"),
        reason: "operator requested uninstall",
      },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().extension.lifecycleState).toBe("REMOVED");

    const after = await app.inject({
      method: "GET",
      url: "/v1/extensions/demo.ext?workspaceId=ws_alpha",
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().lifecycleState).toBe("REMOVED");
  });

  it("blocks unsafe manifest before policy/audit or registry mutation", async () => {
    const unsafe = {
      ...manifest(),
      packageArtifactId: ARTIFACT_A,
      execution: {
        kind: "sandbox",
        artifactId: ARTIFACT_A,
        runtime: "node",
        entrypoint: "index.mjs",
      },
    };
    const res = await app.inject({
      method: "POST",
      url: "/v1/extensions/install",
      payload: { ...context("op_blocked_a", "blocked-key-a"), manifest: unsafe },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.type).toBe("EXTENSION_SECURITY_BLOCKED");
    expect(db.raw.prepare("SELECT count(*) AS n FROM extension_revisions").get()).toEqual({
      n: 0,
    });
    expect(db.raw.prepare("SELECT count(*) AS n FROM extension_installations").get()).toEqual({
      n: 0,
    });
    expect(
      db.raw
        .prepare("SELECT count(*) AS n FROM audit_events WHERE operation_id=?")
        .get("op_blocked_a"),
    ).toEqual({ n: 0 });
  });
});
