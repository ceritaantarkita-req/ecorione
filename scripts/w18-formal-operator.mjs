#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stopSpawnedChild } from "./ecorione-engine.mjs";
import {
  assertW18RepositoryState,
  inspectDurableSpendBudget,
  inspectW18RepositoryState,
  loadEnvironment,
  W18_OPENROUTER_PROVIDER_ONLY,
} from "./w18-hosted-economics.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const W18_RUNNER = resolve(ROOT, "scripts/w18-hosted-economics.mjs");
const ENGINE = resolve(ROOT, "scripts/ecorione-engine.mjs");
const USD_PRECISION = 1_000_000;

export const W18_FORMAL_AUTHORIZED_MAX_USD = 0.25;

function roundUsd(value) {
  return Math.round(value * USD_PRECISION) / USD_PRECISION;
}

export function computeFormalDailyCeiling(
  dailyCommittedUsd,
  maxSpendUsd = W18_FORMAL_AUTHORIZED_MAX_USD,
) {
  if (!Number.isFinite(dailyCommittedUsd) || dailyCommittedUsd < 0) {
    throw new Error("W18 daily committed harus USD non-negatif dan finite.");
  }
  if (!Number.isFinite(maxSpendUsd) || maxSpendUsd <= 0) {
    throw new Error("W18 formal max spend harus USD positif dan finite.");
  }
  if (maxSpendUsd > W18_FORMAL_AUTHORIZED_MAX_USD) {
    throw new Error(
      `W18 wrapper tidak boleh melewati otorisasi saat ini $${W18_FORMAL_AUTHORIZED_MAX_USD.toFixed(2)}.`,
    );
  }
  return roundUsd(dailyCommittedUsd + maxSpendUsd);
}

export function assertFormalBudgetReadiness(
  spend,
  maxSpendUsd = W18_FORMAL_AUTHORIZED_MAX_USD,
) {
  const failures = [];
  if (!Number.isFinite(spend?.dailyCommittedUsd) || spend.dailyCommittedUsd < 0) {
    failures.push("daily committed ledger tidak valid");
  }
  if (!Number.isFinite(spend?.monthlyCommittedUsd) || spend.monthlyCommittedUsd < 0) {
    failures.push("monthly committed ledger tidak valid");
  }
  if (spend?.monthlyUsd === null || spend?.monthlyHeadroomUsd === null) {
    failures.push("ECORIONE_SPEND_MONTHLY_USD wajib dikonfigurasi untuk formal W18");
  } else if (spend.monthlyHeadroomUsd + 1e-9 < maxSpendUsd) {
    failures.push(
      `monthly headroom $${spend.monthlyHeadroomUsd} lebih kecil dari formal cap $${maxSpendUsd}`,
    );
  }
  if (failures.length > 0) {
    throw new Error(`W18 formal budget readiness gagal: ${failures.join("; ")}`);
  }
  return {
    day: spend.day,
    month: spend.month,
    dailyCommittedUsd: spend.dailyCommittedUsd,
    monthlyCommittedUsd: spend.monthlyCommittedUsd,
    monthlyHeadroomUsd: spend.monthlyHeadroomUsd,
    formalDailyCeilingUsd: computeFormalDailyCeiling(spend.dailyCommittedUsd, maxSpendUsd),
  };
}

export function buildFormalRuntimeEnv(
  baseEnv,
  spend,
  maxSpendUsd = W18_FORMAL_AUTHORIZED_MAX_USD,
) {
  const readiness = assertFormalBudgetReadiness(spend, maxSpendUsd);
  return {
    ...baseEnv,
    ECORIONE_COST_KILL_SWITCH: "0",
    ECORIONE_OPENROUTER_PROVIDER_ONLY: W18_OPENROUTER_PROVIDER_ONLY,
    ECORIONE_SPEND_DAILY_USD: readiness.formalDailyCeilingUsd.toFixed(6),
    ECORIONE_W18_ALLOW_SPEND: "YES",
    ECORIONE_W18_MAX_SPEND_USD: maxSpendUsd.toFixed(2),
    ECORIONE_ENGINE_NO_OPEN: "1",
  };
}

function parseArgs(argv) {
  const execute = argv.includes("--execute-authorized-w18");
  const unknown = argv.filter(
    (arg) => arg !== "--execute-authorized-w18" && arg !== "--preflight-only",
  );
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
  if (execute && argv.includes("--preflight-only")) {
    throw new Error("Pilih salah satu: --preflight-only atau --execute-authorized-w18.");
  }
  return { execute };
}

async function requestJson(url, { token, body, timeoutMs = 10_000 } = {}) {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "PUT",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function assertNoExistingConnect(connectUrl, token) {
  try {
    const response = await fetch(new URL("/healthz", connectUrl), {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(1_000),
    });
    if (response.ok) {
      throw new Error(
        "Connect sudah berjalan. Hentikan engine lama sebelum memakai W18 formal operator wrapper.",
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Connect sudah berjalan")) {
      throw error;
    }
  }
}

async function waitForConnect(connectUrl, token, child, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("ECORIONE engine berhenti sebelum Connect ready.");
    }
    try {
      const response = await fetch(new URL("/healthz", connectUrl), {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) return;
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("Connect belum ready setelah 90 detik.");
}

function runNode(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} gagal dengan exit ${String(result.status)}`);
  }
}

function sanitizedSpend(spend) {
  return {
    day: spend.day,
    month: spend.month,
    dailyCommittedUsd: spend.dailyCommittedUsd,
    monthlyCommittedUsd: spend.monthlyCommittedUsd,
    unsettledReservations: spend.unsettledReservations,
    monthlyHeadroomUsd: spend.monthlyHeadroomUsd,
  };
}

export async function runFormalOperator(argv = process.argv.slice(2)) {
  const { execute } = parseArgs(argv);
  const repository = inspectW18RepositoryState(ROOT);
  assertW18RepositoryState(repository);

  const { env: baseEnv } = loadEnvironment(ROOT);
  const spendBefore = inspectDurableSpendBudget(baseEnv, { root: ROOT });
  const formalEnv = buildFormalRuntimeEnv(baseEnv, spendBefore);
  const connectUrl = formalEnv.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";
  const token = formalEnv.ECORIONE_INTERNAL_TOKEN;

  await assertNoExistingConnect(connectUrl, token);

  console.log(
    JSON.stringify(
      {
        phase: execute ? "formal-execution" : "preflight-only",
        repository,
        spendBefore: sanitizedSpend(spendBefore),
        formalDailyCeilingUsd: Number(formalEnv.ECORIONE_SPEND_DAILY_USD),
        maxSpendUsd: W18_FORMAL_AUTHORIZED_MAX_USD,
        providerOnly: W18_OPENROUTER_PROVIDER_ONLY,
        note: "No .env mutation; formal overrides live only in child-process environment.",
      },
      null,
      2,
    ),
  );

  const engine = spawn(process.execPath, [ENGINE, "start"], {
    cwd: ROOT,
    env: formalEnv,
    stdio: "inherit",
    windowsHide: true,
  });

  let originalRuntime = null;
  let hostedEnabled = false;
  try {
    await waitForConnect(connectUrl, token, engine);
    const current = await requestJson(`${connectUrl}/v1/settings/runtime`, { token });
    originalRuntime = current?.settings ?? null;

    await requestJson(`${connectUrl}/v1/settings/runtime`, {
      token,
      body: { hostedProvider: "openrouter", hostedCallsEnabled: false },
    });

    runNode(W18_RUNNER, ["--preflight"], formalEnv);
    console.log("PASS W18 operator wrapper zero-spend preflight.");

    if (!execute) {
      console.log(
        "Preflight-only selesai. Tidak ada izin spend yang dipakai dan hostedCallsEnabled tetap false.",
      );
      return;
    }

    await requestJson(`${connectUrl}/v1/settings/runtime`, {
      token,
      body: { hostedProvider: "openrouter", hostedCallsEnabled: true },
    });
    hostedEnabled = true;

    runNode(W18_RUNNER, [], formalEnv);
    console.log("PASS W18 formal operator wrapper: formal harness selesai.");
  } finally {
    try {
      if (token) {
        await requestJson(`${connectUrl}/v1/settings/runtime`, {
          token,
          body: {
            hostedCallsEnabled: false,
            ...(originalRuntime?.hostedProvider
              ? { hostedProvider: originalRuntime.hostedProvider }
              : {}),
          },
          timeoutMs: 5_000,
        });
      }
      hostedEnabled = false;
    } catch (error) {
      console.error(
        `WARNING cleanup runtime settings gagal: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await stopSpawnedChild(engine, 5_000);

    const safeEnv = {
      ...baseEnv,
      ECORIONE_COST_KILL_SWITCH: "1",
      ECORIONE_W18_ALLOW_SPEND: "",
      ECORIONE_W18_MAX_SPEND_USD: "",
      ECORIONE_OPENROUTER_PROVIDER_ONLY: "",
    };
    const spendAfter = inspectDurableSpendBudget(safeEnv, { root: ROOT });
    console.log(
      JSON.stringify(
        {
          cleanup: {
            hostedCallsEnabled: hostedEnabled,
            costKillSwitchForFutureProcess: 1,
            engineStopped: engine.exitCode !== null || engine.signalCode !== null,
          },
          spendAfter: sanitizedSpend(spendAfter),
        },
        null,
        2,
      ),
    );
  }
}

const isDirect =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
  runFormalOperator().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
