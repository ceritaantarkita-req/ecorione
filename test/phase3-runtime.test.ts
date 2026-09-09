import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeId, type PolicyVerdict } from "../packages/shared-schema/src/index.js";
import { ArtifactStore } from "../services/artifact/src/store.js";
import { createContextMetadataClient } from "../services/artifact/src/context-client.js";
import { buildArtifactServer } from "../services/artifact/src/http.js";
import { registerArtifactRoutes } from "../services/context/src/artifact-routes.js";
import { openContextDatabase, type ContextDatabase } from "../services/context/src/db.js";
import { buildContextServer } from "../services/context/src/http.js";
import { ContextRepository } from "../services/context/src/repository.js";
import type { SandboxControlPlane } from "../services/sandbox/src/clients.js";
import { SandboxExecutor } from "../services/sandbox/src/executor.js";
import { SandboxReceiptStore } from "../services/sandbox/src/receipt-store.js";
import { openSpaceDatabase, type SpaceDatabase } from "../services/space/src/db.js";
import { buildSpaceServer } from "../services/space/src/http.js";
import { SpaceStore } from "../services/space/src/store.js";

const roots: string[] = [];
const contextDbs: ContextDatabase[] = [];
const spaceDbs: SpaceDatabase[] = [];
afterEach(() => {
  for (const db of spaceDbs.splice(0)) db.close();
  for (const db of contextDbs.splice(0)) db.close();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ecorione-phase3-"));
  roots.push(root);
  return root;
}

async function actualContext() {
  const db = openContextDatabase();
  contextDbs.push(db);
  const repo = new ContextRepository(db);
  const app = buildContextServer(repo, undefined);
  registerArtifactRoutes(app, repo);
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string")
    throw new Error("Context address gagal.");
  return { app, repo, url: `http://127.0.0.1:${String(address.port)}` };
}

const allowControl: SandboxControlPlane = {
  async evaluate(): Promise<PolicyVerdict> {
    return { outcome: "ALLOW", reason: "runtime acceptance" };
  },
  async trace(): Promise<void> {},
};

function const42WasmBase64(): string {
  const bytes = Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
    0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00, 0x0a, 0x06,
    0x01, 0x04, 0x00, 0x41, 0x2a, 0x0b,
  ]);
  return Buffer.from(bytes).toString("base64");
}

describe("Fase 3 runtime acceptance", () => {
  it("Artifact CAS and Space core-memory use the real Context service boundary", async () => {
    const root = tempRoot();
    const context = await actualContext();

    const artifact = buildArtifactServer(
      new ArtifactStore(join(root, "artifacts")),
      createContextMetadataClient(context.url),
    );
    const upload = await artifact.inject({
      method: "POST",
      url: "/v1/artifacts",
      payload: {
        contentBase64: Buffer.from("phase3-artifact").toString("base64"),
        mimeType: "text/plain",
        description: "runtime artifact",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
    });
    expect(upload.statusCode).toBe(201);
    const artifactId = (upload.json() as { pointer: { id: string } }).pointer.id;
    const content = await artifact.inject({
      method: "GET",
      url: `/v1/artifacts/${artifactId}/content?scope=personal&maxSensitivity=INTERNAL`,
    });
    expect(content.statusCode).toBe(200);
    expect(content.body).toBe("phase3-artifact");
    const denied = await artifact.inject({
      method: "GET",
      url: `/v1/artifacts/${artifactId}/content?scope=work&maxSensitivity=INTERNAL`,
    });
    expect(denied.statusCode).toBe(404);

    const spaceDb = openSpaceDatabase(":memory:");
    spaceDbs.push(spaceDb);
    const space = buildSpaceServer(new SpaceStore(spaceDb), { contextUrl: context.url });
    const edited = await space.inject({
      method: "PUT",
      url: "/v1/core-memory/preferences",
      payload: {
        description: "Stable preferences",
        value: "Prefer concise technical answers",
        scope: "personal",
        sensitivity: "INTERNAL",
        syncClass: "LOCAL_ONLY",
      },
    });
    expect(edited.statusCode).toBe(200);
    expect(context.repo.getCoreMemory({ scopes: ["personal"] }).blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "preferences",
          value: "Prefer concise technical answers",
        }),
      ]),
    );

    await space.close();
    await artifact.close();
    await context.app.close();
  });

  it("executes Tier 0 and zero-import WASM Tier 1.5 and writes receipts", async () => {
    const root = tempRoot();
    const workspace = join(root, "workspace");
    mkdirSync(workspace);
    const executor = new SandboxExecutor(
      root,
      allowControl,
      new SandboxReceiptStore(join(root, "receipts")),
    );
    const tier0 = await executor.execute({
      operationId: makeId("operation"),
      tier: "tier0",
      workspace,
      command: "pwd",
      wasmBase64: null,
      wasmExport: "run",
      wasmArgs: [],
      irreversible: false,
      idempotencyKey: "phase3-tier0-runtime",
      scope: "personal",
      sensitivity: "INTERNAL",
    });
    expect(tier0.exitCode).toBe(0);
    expect(tier0.stdout.trim().length).toBeGreaterThan(0);

    const wasm = await executor.execute({
      operationId: makeId("operation"),
      tier: "tier1.5",
      workspace,
      command: null,
      wasmBase64: const42WasmBase64(),
      wasmExport: "run",
      wasmArgs: [],
      irreversible: false,
      idempotencyKey: "phase3-wasm-runtime",
      scope: "personal",
      sensitivity: "INTERNAL",
    });
    expect(wasm.exitCode).toBe(0);
    expect(wasm.stdout).toBe("42");
  });

  it.skipIf(process.env.ECORIONE_PHASE3_DOCKER_ACCEPTANCE !== "1")(
    "executes Tier 1 in a real hardened Docker container",
    async () => {
      const root = tempRoot();
      const workspace = join(root, "workspace");
      mkdirSync(workspace);
      const executor = new SandboxExecutor(
        root,
        allowControl,
        new SandboxReceiptStore(join(root, "receipts")),
      );
      const result = await executor.execute({
        operationId: makeId("operation"),
        tier: "tier1",
        workspace,
        command: "pwd",
        wasmBase64: null,
        wasmExport: "run",
        wasmArgs: [],
        irreversible: false,
        idempotencyKey: "phase3-docker-runtime",
        scope: "personal",
        sensitivity: "INTERNAL",
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("/workspace");
    },
    45_000,
  );
});
