import { EventEmitter } from "node:events";
import { URL } from "node:url";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Headers, Response } from "undici";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_FALLBACK_PORTS,
  DEFAULT_AI_PORT,
  aiPortCandidates,
  ensureLocalEnv,
  parseSimpleEnv,
  probeLocalRuntime,
  readEngineRuntimeState,
  resolveAiRuntime,
  resolveCommandInvocation,
  resolvePreferredAiPort,
  selectAiPort,
  writeEngineRuntimeState,
  stopSpawnedChild,
  waitForAiReady,
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

  it("migrates the historical generated Ai port 3000 exactly once", () => {
    const root = tempRoot();
    writeFileSync(
      join(root, ".env"),
      [
        "ECORIONE_AI_PORT=3000",
        "ECORIONE_INTERNAL_TOKEN=already-set",
        "ECORIONE_CONNECT_VAULT_MASTER_KEY=already-set",
        "",
      ].join("\n"),
    );

    const first = ensureLocalEnv(root);
    expect(first.migratedLegacyAiPort).toBe(true);
    expect(first.values.ECORIONE_AI_PORT).toBe("17020");
    expect(first.values.ECORIONE_AI_PORT_MIGRATION_VERSION).toBe("1");

    let text = readFileSync(join(root, ".env"), "utf8");
    text = upsertEnvValue(text, "ECORIONE_AI_PORT", "3000");
    writeFileSync(join(root, ".env"), text);
    const second = ensureLocalEnv(root);
    expect(second.migratedLegacyAiPort).toBe(false);
    expect(second.values.ECORIONE_AI_PORT).toBe("3000");
  });

  it("waits for the ECORIONE HTTP identity rather than accepting a bare TCP listener", async () => {
    const dispositions = ["occupied", "occupied", "ecorione"];
    const classify = vi.fn(async () => dispositions.shift() ?? "ecorione");

    await expect(waitForAiReady(17020, 100, classify, 1)).resolves.toBeUndefined();
    expect(classify).toHaveBeenCalledTimes(3);
  });

  it("does not hardcode port 3000 in the Ai package scripts", () => {
    const aiPackage = JSON.parse(
      readFileSync(new URL("../apps/ai/package.json", import.meta.url), "utf8"),
    );
    expect(aiPackage.scripts.dev).toBe("next dev");
    expect(aiPackage.scripts.start).toBe("next start");
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
    expect(JSON.parse(seenBody)).toEqual({ target: "local", maxLatencyMs: 5_000 });
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

  it("reserves a collision-safe Ai port range", () => {
    expect(DEFAULT_AI_PORT).toBe(17020);
    expect(AI_FALLBACK_PORTS).toEqual([
      17029, 17030, 17031, 17032, 17033, 17034, 17035, 17036, 17037, 17038, 17039,
    ]);
    expect(aiPortCandidates(17020)).toEqual([17020, ...AI_FALLBACK_PORTS]);
    expect(aiPortCandidates(18555)).toEqual([18555, 17020, ...AI_FALLBACK_PORTS]);
    expect(() => resolvePreferredAiPort({ ECORIONE_AI_PORT: "17021" })).toThrow(
      /reserved service port/,
    );
  });

  it("falls back without touching an unrelated preferred-port listener", async () => {
    const selected = await selectAiPort(3000, async (port) =>
      port === 3000 ? "occupied" : port === 17020 ? "free" : "occupied",
    );
    expect(selected).toEqual({
      port: 17020,
      preferredPort: 3000,
      fallbackUsed: true,
      collisions: [3000],
    });
  });

  it("fails closed when a candidate already belongs to ECORIONE", async () => {
    await expect(selectAiPort(17020, async () => "ecorione")).rejects.toThrow(/sudah berjalan/);
  });

  it("resolves the selected Ai endpoint from local runtime state", () => {
    const root = tempRoot();
    writeEngineRuntimeState(
      {
        schemaVersion: 1,
        preferredAiPort: 17020,
        aiPort: 17029,
        aiUrl: "http://127.0.0.1:17029",
        fallbackUsed: true,
      },
      root,
    );
    expect(readEngineRuntimeState(root)?.aiPort).toBe(17029);
    expect(resolveAiRuntime({}, root)).toMatchObject({
      port: 17029,
      url: "http://127.0.0.1:17029",
      fallbackUsed: true,
      source: "runtime-state",
    });
  });

  it("uses cmd.exe explicitly for pnpm on Windows instead of spawning pnpm.cmd directly", () => {
    expect(
      resolveCommandInvocation("pnpm", ["--version"], "win32", {
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
      }),
    ).toEqual({
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "pnpm.cmd --version"],
    });
  });

  it("keeps non-Windows pnpm invocation direct", () => {
    expect(resolveCommandInvocation("pnpm", ["--version"], "linux", {})).toEqual({
      command: "pnpm",
      args: ["--version"],
    });
  });

  it("rejects unsafe Windows pnpm arguments instead of interpolating shell metacharacters", () => {
    expect(() =>
      resolveCommandInvocation("pnpm", ["run", "dev:phase4 & calc"], "win32", {}),
    ).toThrow("Argumen pnpm Windows tidak aman");
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

  it("kills the full spawned process tree during Windows startup cleanup", async () => {
    class FakeWindowsChild extends EventEmitter {
      pid = 4321;
      exitCode = null;
      signalCode = null;
      signals = [];

      kill(signal) {
        this.signals.push(signal);
        return true;
      }
    }

    const child = new FakeWindowsChild();
    const treePids = [];
    await stopSpawnedChild(child, 0, "win32", (pid) => {
      treePids.push(pid);
      child.exitCode = 1;
      child.emit("exit", 1, null);
      return true;
    });

    expect(treePids).toEqual([4321]);
    expect(child.signals).toEqual([]);
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
