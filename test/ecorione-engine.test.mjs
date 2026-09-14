import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Headers, Response } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureLocalEnv,
  parseSimpleEnv,
  probeLocalRuntime,
  stopSpawnedChild,
  temporalCliAvailable,
  temporalInstallHint,
  upsertEnvValue,
  waitForSpawnedChild,
} from "../scripts/ecorione-engine.mjs";

const roots = [];

afterEach(() => {
  vi.unstubAllGlobals();
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ecorione-engine-"));
  roots.push(root);
  return root;
}

describe("ECORIONE local engine bootstrap", () => {
  it("parses simple env values without treating comments as config", () => {
    expect(parseSimpleEnv("# note\nA=one\nB=\"two words\"\nC='three words'\n\n")).toEqual({
      A: "one",
      B: "two words",
      C: "three words",
    });
  });

  it("updates one env value without duplicating its key", () => {
    const next = upsertEnvValue("A=one\nB=two\n", "B", "changed");
    expect(next.match(/^B=/gm)).toHaveLength(1);
    expect(parseSimpleEnv(next).B).toBe("changed");
  });

  it("creates .env and generates local secrets while preserving configured values", () => {
    const root = tempRoot();
    writeFileSync(
      join(root, ".env.example"),
      [
        "ECORIONE_INTERNAL_TOKEN=",
        "ECORIONE_CONNECT_VAULT_MASTER_KEY=",
        "ECORIONE_LOCAL_MODEL=qwen3:8b-instruct-q4_K_M",
        "",
      ].join("\n"),
    );

    const first = ensureLocalEnv(root);
    const written = parseSimpleEnv(readFileSync(join(root, ".env"), "utf8"));

    expect(first.created).toBe(true);
    expect(first.generated.sort()).toEqual(
      ["ECORIONE_CONNECT_VAULT_MASTER_KEY", "ECORIONE_INTERNAL_TOKEN"].sort(),
    );
    expect(written.ECORIONE_INTERNAL_TOKEN).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(written.ECORIONE_CONNECT_VAULT_MASTER_KEY).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(written.ECORIONE_LOCAL_MODEL).toBe("qwen3:8b-instruct-q4_K_M");

    const token = written.ECORIONE_INTERNAL_TOKEN;
    const vaultKey = written.ECORIONE_CONNECT_VAULT_MASTER_KEY;
    const second = ensureLocalEnv(root);
    const afterSecond = parseSimpleEnv(readFileSync(join(root, ".env"), "utf8"));

    expect(second.created).toBe(false);
    expect(second.generated).toEqual([]);
    expect(afterSecond.ECORIONE_INTERNAL_TOKEN).toBe(token);
    expect(afterSecond.ECORIONE_CONNECT_VAULT_MASTER_KEY).toBe(vaultKey);
  });

  it("probes the configured local AI through Connect without vendor-specific runtime logic", async () => {
    let seenUrl = "";
    let seenAuthorization = "";
    let seenBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        seenUrl = String(url);
        seenAuthorization = new Headers(init?.headers).get("authorization") ?? "";
        seenBody = String(init?.body ?? "");
        return new Response(
          JSON.stringify({
            pass: true,
            model: "local/provider-token-zero",
            responseModel: "gemma-test-pinned",
            modelIdentity: `local:openai-compatible:gemma-test-pinned@sha256:${"a".repeat(64)}`,
            modelIdentityPinned: true,
            latencyMs: 42.5,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const result = await probeLocalRuntime("http://127.0.0.1:17023/", "doctor-token", 5_000);

    expect(seenUrl).toBe("http://127.0.0.1:17023/v1/ops/provider-canary");
    expect(seenAuthorization).toBe("Bearer doctor-token");
    expect(JSON.parse(seenBody)).toEqual({ target: "local" });
    expect(result).toEqual({
      reachable: true,
      pass: true,
      model: "local/provider-token-zero",
      responseModel: "gemma-test-pinned",
      modelIdentity: `local:openai-compatible:gemma-test-pinned@sha256:${"a".repeat(64)}`,
      modelIdentityPinned: true,
      latencyMs: 42.5,
    });
  });

  it("reports a machine-readable local runtime failure returned by Connect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { type: "PROVIDER_UNREACHABLE", message: "runtime down" },
            }),
            { status: 503, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(
      probeLocalRuntime("http://127.0.0.1:17023", "doctor-token", 5_000),
    ).resolves.toEqual({
      reachable: true,
      pass: false,
      errorCode: "PROVIDER_UNREACHABLE",
    });
  });

  it("reports child spawn errors immediately instead of waiting for readiness timeout", async () => {
    const child = new EventEmitter();
    const lifecycle = waitForSpawnedChild(child);
    const error = new Error("spawn pnpm ENOENT");

    child.emit("error", error);

    await expect(lifecycle).resolves.toEqual({ error });
  });

  it("stops a spawned stack gracefully during startup cleanup", async () => {
    class FakeChild extends EventEmitter {
      exitCode = null;
      signalCode = null;
      signals = [];

      kill(signal) {
        this.signals.push(signal);
        void Promise.resolve().then(() => {
          this.signalCode = signal;
          this.emit("exit", null, signal);
        });
        return true;
      }
    }

    const child = new FakeChild();
    await stopSpawnedChild(child, 50);

    expect(child.signals).toEqual(["SIGTERM"]);
  });

  it("escalates startup cleanup to SIGKILL when graceful termination does not finish", async () => {
    class FakeChild extends EventEmitter {
      exitCode = null;
      signalCode = null;
      signals = [];

      kill(signal) {
        this.signals.push(signal);
        if (signal === "SIGKILL") {
          this.signalCode = signal;
          this.emit("exit", null, signal);
        }
        return true;
      }
    }

    const child = new FakeChild();
    await stopSpawnedChild(child, 0);

    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("points Windows users at the Temporal CLI PowerShell installer", () => {
    expect(temporalInstallHint("win32")).toContain("iwr https://temporal.download/cli.ps1");
  });

  it("offers brew and the shell installer on macOS", () => {
    const hint = temporalInstallHint("darwin");
    expect(hint).toContain("brew install temporal");
    expect(hint).toContain("curl -sSf https://temporal.download/cli.sh | sh");
  });

  it("falls back to the shell installer on Linux and other platforms", () => {
    expect(temporalInstallHint("linux")).toContain(
      "curl -sSf https://temporal.download/cli.sh | sh",
    );
  });

  it("reports whether the Temporal CLI binary is on PATH without throwing", () => {
    // Tidak menganggap CLI-nya terpasang atau tidak di mesin CI — cuma memastikan
    // pemeriksaannya sendiri tidak pernah melempar, karena ensureTemporal() bergantung
    // pada ini untuk memilih jalur CLI vs pesan instalasi vs Docker.
    expect(typeof temporalCliAvailable()).toBe("boolean");
  });
});
