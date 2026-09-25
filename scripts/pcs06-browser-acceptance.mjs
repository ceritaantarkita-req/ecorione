import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.PCS06_BASE_URL ?? "http://127.0.0.1:3000";
const outDir = process.env.PCS06_ARTIFACT_DIR ?? "artifacts/pcs06-browser";
await mkdir(outDir, { recursive: true });

const now = "2026-09-20T09:15:00.000";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const STALE_PROJECT_ID = "prj_archived";
const PROJECT_STORAGE_KEY = "ecorione.projectId";
const project = {
  id: "prj_personal",
  workspaceId: "ws_personal",
  name: "Personal",
  description: "",
  instruction: "",
  memoryPolicy: "GLOBAL_PLUS_PROJECT",
  autonomyCeiling: "L3",
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};
const projectSecondary = {
  ...project,
  id: "prj_research",
  name: "Research",
};
let createdProjects = [];
const historySession = {
  id: "sess_pcs06browser",
  createdAt: now,
  updatedAt: now,
  workspaceId: "ws_personal",
  projectId: "prj_personal",
  title: "PCS-06 Browser",
  scope: "personal",
  sensitivity: "INTERNAL",
  syncClass: "CLOUD_ALLOWED",
  nextSeq: 2,
  headHash: HASH_B,
};
let historyEvents = [
  {
    id: "evt_pcs06user01",
    recordedAt: now,
    eventType: "user.message",
    actor: "user",
    operationId: "op_pcs06history01",
    parentEventId: null,
    payload: { text: "Earlier hosted question", target: "hosted" },
    sessionId: historySession.id,
    seq: 0,
    prevHash: null,
    hash: HASH_A,
  },
  {
    id: "evt_pcs06agent01",
    recordedAt: now,
    eventType: "agent.message",
    actor: "assistant",
    operationId: "op_pcs06history01",
    parentEventId: "evt_pcs06user01",
    payload: { text: "Earlier hosted reply" },
    sessionId: historySession.id,
    seq: 1,
    prevHash: HASH_A,
    hash: HASH_B,
  },
];

let runtime = {
  revision: 1,
  settings: {
    hostedProvider: "openrouter",
    hostedModel: "gpt-5.6-sol",
    localRuntime: "openai-compatible",
    localBaseUrl: "http://127.0.0.1:11434/v1",
    localModelTag: "qwen3.5:9b",
    localModelDigest: null,
    hostedCallsEnabled: true,
    defaultChatTarget: "hosted",
  },
};
let credentials = [
  { provider: "openrouter", purpose: "tokens", generation: 1, updatedAt: now },
];
const providers = [
  {
    id: "openrouter",
    displayName: "OpenRouter",
    category: "ai",
    credentialPurpose: "tokens",
    credentialReady: true,
    routingReady: true,
    connectionTestReady: true,
    hostedModels: [
      {
        id: "gpt-5.6-sol",
        displayName: "GPT-5.6 Sol",
        providerRuntime: "openrouter",
      },
      {
        id: "gpt-5.6-terra",
        displayName: "GPT-5.6 Terra",
        providerRuntime: "openrouter",
      },
    ],
  },
  {
    id: "anthropic",
    displayName: "Anthropic",
    category: "ai",
    credentialPurpose: "messages",
    credentialReady: true,
    routingReady: true,
    connectionTestReady: true,
    hostedModels: [
      {
        id: "claude-sonnet-4-5-20250929",
        displayName: "Claude Sonnet 4.5",
        providerRuntime: "anthropic",
      },
    ],
  },
  {
    id: "openai",
    displayName: "OpenAI",
    category: "ai",
    credentialPurpose: "tokens",
    credentialReady: true,
    routingReady: true,
    connectionTestReady: true,
    hostedModels: [
      {
        id: "gpt-5.6-terra",
        displayName: "GPT-5.6 Terra",
        providerRuntime: "openai",
      },
      {
        id: "gpt-5.6-sol",
        displayName: "GPT-5.6 Sol",
        providerRuntime: "openai",
      },
    ],
  },
];
const localStatus = {
  runtime: "openai-compatible",
  state: "unreachable",
  reachable: false,
  ready: false,
  configuredModel: "qwen3.5:9b",
  models: [],
  modelDigest: null,
  identityProvenance: "unverified",
  identitySource: "configured",
  message: "Local AI · Not connected.",
};
const spacePage = {
  id: "page_pcs06",
  workspaceId: "ws_personal",
  title: "PCS-06 Notes",
  scope: "personal",
  version: 1,
  createdAt: now,
  updatedAt: now,
};
const brain = {
  workspaceId: "ws_personal",
  projectId: "prj_personal",
  nodes: [
    {
      id: "brain_project_personal",
      type: "Project",
      canonicalId: "prj_personal",
      owner: "Hub",
      label: "Personal",
      workspaceId: "ws_personal",
      projectId: "prj_personal",
      availability: "AVAILABLE",
      href: "/projects",
      metadata: {},
    },
  ],
  edges: [],
  totalNodes: 1,
  totalEdges: 0,
  truncated: false,
};
let scheduleTrigger = {
  id: "trg_pcs06schedule",
  workspaceId: "ws_personal",
  projectId: "prj_personal",
  name: "PCS-06 Daily",
  kind: "time",
  graphId: "fg_pcs06schedule",
  graphVersion: 1,
  versionPolicy: "PINNED",
  requestedAutonomy: "L2",
  enabled: true,
  configuration: {
    cronExpression: "0 8 * * *",
    timezone: "Asia/Jakarta",
    catchupWindowMs: 60_000,
    overlap: "SKIP",
  },
  temporalScheduleId: "sched_pcs06schedule",
  revision: 1,
  createdAt: now,
  updatedAt: now,
};
let scheduleMutationCount = 0;
const scheduleRuntime = {
  triggerId: scheduleTrigger.id,
  scheduleId: scheduleTrigger.temporalScheduleId,
  paused: false,
  nextActionTimes: [
    "2026-09-25T01:00:00.000Z",
    "2026-09-26T01:00:00.000Z",
    "2026-10-01T01:00:00.000Z",
  ],
  recentActionCount: 2,
};

const flowDefinitions = [
  {
    id: "core/trigger/v1",
    kind: "trigger",
    version: 1,
    label: "Trigger",
    category: "trigger",
    description: "Start the graph.",
    inputPorts: [],
    outputPorts: [{ id: "out", label: "Output", valueType: "any" }],
    capabilities: [{ capabilityId: "node.execute", permissionIds: ["node.execute"] }],
    policyActionClass: null,
    sideEffect: false,
    secretRefPolicy: "none",
    limits: {
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      maxIterations: 100,
      maxParallelism: 4,
    },
    retry: {
      maximumAttempts: 1,
      initialIntervalMs: 1000,
      maximumIntervalMs: 10000,
    },
    idempotency: "none",
  },
  {
    id: "core/ai/v1",
    kind: "ai",
    version: 1,
    label: "AI",
    category: "ai",
    description: "AI execution.",
    inputPorts: [{ id: "in", label: "Input", valueType: "any" }],
    outputPorts: [{ id: "out", label: "Output", valueType: "any" }],
    capabilities: [{ capabilityId: "node.execute", permissionIds: ["node.execute"] }],
    policyActionClass: null,
    sideEffect: false,
    secretRefPolicy: "none",
    limits: {
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      maxIterations: 100,
      maxParallelism: 4,
    },
    retry: {
      maximumAttempts: 1,
      initialIntervalMs: 1000,
      maximumIntervalMs: 10000,
    },
    idempotency: "none",
  },
  {
    id: "core/condition/v1",
    kind: "condition",
    version: 1,
    label: "Condition / Switch",
    category: "control",
    description: "Conditional branch.",
    inputPorts: [{ id: "in", label: "Input", valueType: "any" }],
    outputPorts: [
      { id: "true", label: "True", valueType: "any" },
      { id: "false", label: "False", valueType: "any" },
    ],
    capabilities: [{ capabilityId: "node.execute", permissionIds: ["node.execute"] }],
    policyActionClass: null,
    sideEffect: false,
    secretRefPolicy: "none",
    limits: {
      timeoutMs: 120000,
      maxOutputBytes: 1048576,
      maxIterations: 100,
      maxParallelism: 4,
    },
    retry: {
      maximumAttempts: 1,
      initialIntervalMs: 1000,
      maximumIntervalMs: 10000,
    },
    idempotency: "none",
  },
];

let savedFlowVersion = null;
let authorityReady = false;
let graphRunStarted = false;
let aggregateProjectHistoryRequested = false;
const staleProjectOwnerRequests = [];
const externalRequests = new Set();

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function updatedSession() {
  const last = historyEvents.at(-1);
  return {
    ...historySession,
    updatedAt: now,
    nextSeq: historyEvents.length,
    headHash: last?.hash ?? null,
  };
}

function historyRange() {
  return {
    sessionId: historySession.id,
    afterSeq: -1,
    throughSeq: historyEvents.length - 1,
    nextSeq: historyEvents.length,
    events: historyEvents,
  };
}

function saveFlow(body) {
  const graph = {
    id: "fg_pcs06browser",
    ...body,
    projectId: "prj_personal",
  };
  delete graph.expectedVersion;
  const validation = {
    valid: true,
    issues: [],
    plan: { planDigest: HASH_A },
  };
  savedFlowVersion = {
    graphId: graph.id,
    version: 1,
    digest: HASH_B,
    graph,
    validation,
    createdAt: now,
  };
  return { version: savedFlowVersion, deduplicated: false };
}

async function installApiMocks(context) {
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/") &&
      url.searchParams.get("projectId") === STALE_PROJECT_ID
    ) {
      staleProjectOwnerRequests.push(`${request.method()} ${url.pathname}`);
    }
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "127.0.0.1" &&
      url.hostname !== "localhost"
    ) {
      externalRequests.add(request.url());
    }
  });

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/projects" && method === "GET") {
      return json(route, { projects: [project, projectSecondary, ...createdProjects] });
    }
    if (path === "/api/projects" && method === "POST") {
      const body = request.postDataJSON();
      const created = {
        ...project,
        id: "prj_pcs06inline",
        name: body.name,
        createdAt: now,
        updatedAt: now,
      };
      createdProjects = [
        ...createdProjects.filter((candidate) => candidate.id !== created.id),
        created,
      ];
      return json(route, created, 201);
    }
    if (path === "/api/projects/history" && method === "GET") {
      if (!url.searchParams.has("projectId")) aggregateProjectHistoryRequested = true;
      return json(route, { sessions: [updatedSession()] });
    }
    if (path === `/api/projects/history/${historySession.id}` && method === "GET") {
      return json(route, {
        session: updatedSession(),
        range: historyRange(),
        truncated: false,
      });
    }
    if (path === "/api/projects/source-catalog" && method === "GET") {
      return json(route, { items: [], warnings: [] });
    }
    if (path === "/api/projects/prj_personal/sources" && method === "GET") {
      return json(route, { sources: [] });
    }
    if (path === "/api/chat" && method === "POST") {
      const body = request.postDataJSON();
      const seq = historyEvents.length;
      const userId = `evt_pcs06user${String(seq).padStart(2, "0")}`;
      const agentId = `evt_pcs06agent${String(seq + 1).padStart(2, "0")}`;
      const prevHash = historyEvents.at(-1)?.hash ?? null;
      historyEvents = [
        ...historyEvents,
        {
          id: userId,
          recordedAt: now,
          eventType: "user.message",
          actor: "user",
          operationId: "op_pcs06chat01",
          parentEventId: null,
          payload: { text: body.message, target: body.target },
          sessionId: historySession.id,
          seq,
          prevHash,
          hash: HASH_A,
        },
        {
          id: agentId,
          recordedAt: now,
          eventType: "agent.message",
          actor: "assistant",
          operationId: "op_pcs06chat01",
          parentEventId: userId,
          payload: { text: "PCS06_HOSTED_OK" },
          sessionId: historySession.id,
          seq: seq + 1,
          prevHash: HASH_A,
          hash: HASH_B,
        },
      ];
      return json(route, {
        operationId: "op_pcs06chat01",
        sessionId: historySession.id,
        reply: "PCS06_HOSTED_OK",
        memoryUsed: { coreMemoryBlocks: [], recalledFacts: [], episodicSummaries: [] },
        cost: {
          model: "gpt-5.6-sol",
          cacheHit: false,
          actualUsd: 0,
          naiveUsd: 0,
          savedUsd: 0,
          savedPct: 0,
          routeReason: "pcs06-browser-stub",
        },
        policy: {
          outcome: "ALLOW",
          reason: "PCS-06 deterministic browser stub.",
          ruleId: "pcs06",
        },
      });
    }

    if (path === "/api/work/schedule-assist" && method === "POST") {
      return json(route, {
        draft: {
          name: "PCS-06 Weekday",
          graphId: scheduleTrigger.graphId,
          graphVersion: scheduleTrigger.graphVersion,
          requestedAutonomy: scheduleTrigger.requestedAutonomy,
          enabled: scheduleTrigger.enabled,
          configuration: {
            cronExpression: "30 9 * * 1-5",
            timezone: "Asia/Jakarta",
            catchupWindowMs: scheduleTrigger.configuration.catchupWindowMs,
            overlap: scheduleTrigger.configuration.overlap,
          },
        },
        summary: "Drafted weekdays at 09:30 WIB.",
        source: "local-model",
      });
    }

    if (path === "/api/settings/settings/runtime" && method === "GET") {
      return json(route, runtime);
    }
    if (path === "/api/settings/settings/runtime" && method === "PUT") {
      const body = request.postDataJSON();
      runtime = {
        revision: runtime.revision + 1,
        settings: { ...runtime.settings, ...body },
      };
      return json(route, runtime);
    }
    if (path === "/api/settings/settings/providers" && method === "GET") {
      return json(route, { providers });
    }
    if (path === "/api/settings/settings/credentials" && method === "GET") {
      return json(route, { credentials });
    }
    if (path === "/api/settings/settings/local-runtime/status") {
      return json(route, localStatus);
    }
    if (
      path.startsWith("/api/settings/settings/credentials/") &&
      path.endsWith("/test") &&
      method === "POST"
    ) {
      const provider = path.split("/").at(-2);
      return json(route, {
        pass: true,
        latencyMs: 12.5,
        provider,
        model: provider === "anthropic" ? "claude-sonnet-4-5-20250929" : "gpt-5.6-sol",
      });
    }
    if (path.startsWith("/api/settings/settings/credentials/") && method === "PUT") {
      const provider = decodeURIComponent(path.split("/").at(-1));
      credentials = [
        ...credentials.filter((item) => item.provider !== provider),
        {
          provider,
          purpose: provider === "anthropic" ? "messages" : "tokens",
          generation: 1,
          updatedAt: now,
        },
      ];
      return json(route, { provider, generation: 1, updatedAt: now });
    }
    if (path === "/api/settings/settings/mcp/servers" && method === "GET") {
      return json(route, { servers: [] });
    }
    if (path === "/api/settings/ops/provider-canary" && method === "POST") {
      const body = request.postDataJSON();
      return json(route, {
        pass: true,
        latencyMs: 9.5,
        provider:
          body.target === "local" ? "openai-compatible" : runtime.settings.hostedProvider,
        model:
          body.target === "local"
            ? runtime.settings.localModelTag
            : runtime.settings.hostedModel,
        modelIdentity: "pcs06-stub",
        modelIdentityPinned: false,
        modelIdentityProvenance: "unverified",
      });
    }

    if (path.startsWith("/api/flow/")) {
      if (path === "/api/flow/nodes" && method === "GET") {
        return json(route, { nodes: flowDefinitions });
      }
      if (path === "/api/flow/triggers" && method === "GET") {
        return json(route, { triggers: [scheduleTrigger] });
      }
      if (path === `/api/flow/triggers/${scheduleTrigger.id}` && method === "PATCH") {
        const body = request.postDataJSON();
        scheduleMutationCount += 1;
        scheduleTrigger = {
          ...scheduleTrigger,
          ...body,
          temporalScheduleId: scheduleTrigger.temporalScheduleId,
          revision: scheduleTrigger.revision + 1,
          updatedAt: now,
        };
        delete scheduleTrigger.expectedRevision;
        return json(route, scheduleTrigger);
      }
      if (path === `/api/flow/triggers/${scheduleTrigger.id}/schedule` && method === "GET") {
        return json(route, scheduleRuntime);
      }
      if (path === "/api/flow/graphs" && method === "GET") {
        return json(route, {
          graphs:
            savedFlowVersion === null
              ? []
              : [
                  {
                    graphId: savedFlowVersion.graphId,
                    workspaceId: "ws_personal",
                    projectId: "prj_personal",
                    name: savedFlowVersion.graph.name,
                    scope: savedFlowVersion.graph.scope,
                    sensitivity: savedFlowVersion.graph.sensitivity,
                    currentVersion: 1,
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
        });
      }
      if (path === "/api/flow/runs" && method === "GET") {
        return json(route, { runs: [] });
      }
      if (path === "/api/flow/graphs/validate" && method === "POST") {
        return json(route, { valid: true, issues: [], plan: { planDigest: HASH_A } });
      }
      if (path === "/api/flow/graphs" && method === "POST") {
        return json(route, saveFlow(request.postDataJSON()), 201);
      }
      if (
        savedFlowVersion !== null &&
        path === `/api/flow/graphs/${savedFlowVersion.graphId}/versions` &&
        method === "GET"
      ) {
        return json(route, { versions: [savedFlowVersion] });
      }
      if (
        savedFlowVersion !== null &&
        path === `/api/flow/graphs/${savedFlowVersion.graphId}/authority/prepare` &&
        method === "POST"
      ) {
        return json(route, {
          ready: authorityReady,
          requirements: [
            {
              definitionId: "core/trigger/v1",
              nodeIds: ["node_trigger1"],
              status: authorityReady ? "GRANTED" : "APPROVAL_REQUIRED",
              operationId: authorityReady ? null : "op_nodegrant_pcs06browser",
              prompt: authorityReady ? null : "Approve node.execute for Trigger.",
            },
          ],
        });
      }
      if (
        savedFlowVersion !== null &&
        path === `/api/flow/graphs/${savedFlowVersion.graphId}/authority/decide` &&
        method === "POST"
      ) {
        const body = request.postDataJSON();
        authorityReady = body.decision === "APPROVE";
        return json(route, {
          definitionId: body.definitionId,
          status: authorityReady ? "GRANTED" : "REJECTED",
        });
      }
      if (
        savedFlowVersion !== null &&
        path === `/api/flow/graphs/${savedFlowVersion.graphId}/runs` &&
        method === "POST"
      ) {
        graphRunStarted = true;
        return json(
          route,
          {
            runId: "wf_pcs06browser",
            graphId: savedFlowVersion.graphId,
            graphVersion: 1,
            temporalWorkflowId: "wf_pcs06browser",
            traceOperationId: "op_pcs06run01",
            planDigest: HASH_A,
          },
          202,
        );
      }
      if (path === "/api/flow/graph-runs/wf_pcs06browser" && method === "GET") {
        return json(route, {
          temporalStatus: "COMPLETED",
          runId: "wf_pcs06browser",
          graphId: savedFlowVersion?.graphId ?? "fg_pcs06browser",
          graphVersion: 1,
          traceOperationId: "op_pcs06run01",
          status: "COMPLETED",
          nodes: [
            {
              nodeId: "node_trigger1",
              status: "SUCCEEDED",
              approvalKey: null,
              message: null,
            },
          ],
          output: { ok: true },
          error: null,
        });
      }
    }

    if (path === "/api/brain" && method === "GET") {
      return json(route, brain);
    }
    if (path === "/api/space/pages" && method === "GET") {
      return json(route, { pages: [spacePage] });
    }
    if (path === `/api/space/pages/${spacePage.id}` && method === "GET") {
      return json(route, { page: spacePage, blocks: [] });
    }
    if (path === "/api/space/core-memory" && method === "GET") {
      return json(route, { blocks: [] });
    }
    if (path === "/api/ops" && method === "GET") {
      return json(route, {
        generatedAt: now,
        healthy: true,
        services: [
          {
            name: "hub",
            required: true,
            healthy: true,
            error: null,
            observability: null,
          },
        ],
        recentTraces: [],
      });
    }

    return json(
      route,
      {
        error: {
          type: "PCS06_UNMOCKED_API",
          message: `Unmocked PCS-06 API: ${method} ${path}`,
        },
      },
      503,
    );
  });
}

function badConsoleMessage(type, text) {
  if (type === "error") return true;
  if (type !== "warning") return false;
  return /(hydration|hydrate|validateDOMNesting|unhandled|uncaught|cannot update)/i.test(text);
}

async function assertNoPageOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: globalThis.innerWidth,
    htmlScrollWidth: globalThis.document.documentElement.scrollWidth,
    bodyScrollWidth: globalThis.document.body.scrollWidth,
  }));
  if (
    metrics.htmlScrollWidth > metrics.innerWidth + 1 ||
    metrics.bodyScrollWidth > metrics.innerWidth + 1
  ) {
    throw new Error(`${label}: page-level horizontal overflow ${JSON.stringify(metrics)}`);
  }
  console.log(`PASS ${label} overflow ${JSON.stringify(metrics)}`);
}

function checkedPage(context, label) {
  return context.newPage().then((page) => {
    const consoleProblems = [];
    const pageErrors = [];
    page.on("console", (message) => {
      const text = message.text();
      if (badConsoleMessage(message.type(), text)) {
        consoleProblems.push(`${message.type()}: ${text}`);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    return {
      page,
      assertClean() {
        if (consoleProblems.length > 0 || pageErrors.length > 0) {
          throw new Error(
            `${label}: browser errors ${JSON.stringify({ consoleProblems, pageErrors })}`,
          );
        }
        console.log(`PASS ${label} console`);
      },
    };
  });
}

async function goto(page, path, label) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
  if (response === null || response.status() >= 400) {
    throw new Error(`${label}: route failed with ${response?.status() ?? "no response"}`);
  }
  await page.waitForTimeout(100);
  await assertNoPageOverflow(page, label);
}

const browser = await chromium.launch({ headless: true });
const failures = [];

async function runDesktopJourney() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await installApiMocks(context);
  const checked = await checkedPage(context, "desktop-integrated");
  const page = checked.page;
  try {
    await goto(page, `/?project=prj_personal&session=${historySession.id}`, "desktop-ai");
    await page.getByText("Earlier hosted reply", { exact: true }).waitFor();
    const modelSelect = page.getByRole("combobox", { name: "Model" });
    if ((await modelSelect.inputValue()) !== "hosted") {
      throw new Error("desktop-ai: replayed hosted conversation did not restore Hosted route");
    }
    if (!(await modelSelect.isDisabled())) {
      throw new Error("desktop-ai: route selector must stay locked after replayed turns");
    }
    const localOption = modelSelect.locator('option[value="local"]');
    if (!(await localOption.isDisabled())) {
      throw new Error("desktop-ai: Local unavailable option must be disabled");
    }
    await page.getByRole("textbox", { name: "Pesan" }).fill("PCS06 browser continuity");
    await page.getByRole("button", { name: "Kirim pesan" }).click();
    await page.getByText("PCS06_HOSTED_OK", { exact: true }).waitFor();
    await page.screenshot({ path: `${outDir}/desktop-ai.png`, fullPage: true });

    await page.getByRole("link", { name: "Projects", exact: true }).click();
    await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
    await page.getByText("PCS-06 Browser", { exact: true }).waitFor();
    aggregateProjectHistoryRequested = false;
    await page.getByRole("button", { name: /All/ }).click();
    await page.getByRole("heading", { name: "All", exact: true }).waitFor();
    await page.getByText("Recent conversations: 1", { exact: true }).waitFor();
    if (!aggregateProjectHistoryRequested) {
      throw new Error("desktop-projects: All did not request aggregate Project history");
    }
    if ((await page.getByRole("button", { name: "Buka Chat", exact: true }).count()) !== 0) {
      throw new Error("desktop-projects: virtual All must not expose a synthetic chat scope");
    }
    await page
      .locator(`a[href="/?project=${project.id}&session=${historySession.id}"]`)
      .waitFor();
    await assertNoPageOverflow(page, "desktop-projects");
    await page.getByRole("link", { name: "Ai", exact: true }).click();
    await page.getByText("PCS06_HOSTED_OK", { exact: true }).waitFor();
    const sessionTag = page.locator(`[title="${historySession.id}"]`);
    if ((await sessionTag.count()) === 0)
      throw new Error("desktop-ai: active session was not restored");

    await page.getByRole("button", { name: "Gunakan tema terang" }).click();
    if (
      (await page.evaluate(() => globalThis.document.documentElement.dataset.theme)) !== "light"
    ) {
      throw new Error("desktop-theme: light theme was not applied");
    }
    await page.getByRole("button", { name: "Gunakan tema gelap" }).click();
    if (
      (await page.evaluate(() => globalThis.document.documentElement.dataset.theme)) !== "dark"
    ) {
      throw new Error("desktop-theme: dark theme was not restored");
    }

    await goto(page, "/work", "desktop-work");
    await page.getByRole("heading", { name: "Work", exact: true }).waitFor();

    const projectSearch = page.getByRole("combobox", { name: "Search Project" });
    await projectSearch.fill("Research");
    await page.getByRole("option").filter({ hasText: "Research" }).waitFor();
    await page.getByRole("button", { name: "+ New Project", exact: true }).click();
    await page.getByRole("textbox", { name: "New Project name" }).fill("PCS-06 Inline");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.waitForFunction(
      (value) => {
        const input = globalThis.document.querySelector(
          'input[aria-label="Search Project"]',
        );
        return input instanceof HTMLInputElement && input.value === value;
      },
      "PCS-06 Inline",
    );
    await projectSearch.fill("Personal");
    await page.getByRole("option").filter({ hasText: "Personal" }).click();

    await page.getByRole("button", { name: "list", exact: true }).click();
    const scheduleCard = page.locator("article").filter({ hasText: "PCS-06 Daily" }).first();
    await scheduleCard.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Describe schedule" })
      .fill("ubah jadi weekdays jam 09.30 WIB");
    await page.getByRole("button", { name: "Draft with local AI", exact: true }).click();
    await page.getByDisplayValue("PCS-06 Weekday").waitFor();
    await page.getByDisplayValue("30 9 * * 1-5").waitFor();
    if (scheduleMutationCount !== 0) {
      throw new Error("desktop-work: AI draft mutated Trigger before explicit Save");
    }
    await page.getByRole("button", { name: "Save schedule", exact: true }).click();
    await page.getByText("PCS-06 Weekday", { exact: true }).waitFor();
    if (scheduleMutationCount !== 1) {
      throw new Error(
        `desktop-work: expected one explicit Trigger mutation, got ${scheduleMutationCount}`,
      );
    }

    await page.getByRole("button", { name: "year", exact: true }).click();
    await page.getByRole("button", { name: "Previous period" }).waitFor();
    await page.getByRole("button", { name: "Today", exact: true }).waitFor();
    await page.getByRole("button", { name: "Next period" }).click();
    await page.getByRole("button", { name: "Today", exact: true }).click();
    await page.getByText(/Temporal occurrence\(s\)/).waitFor();
    await assertNoPageOverflow(page, "desktop-work-calendar-year");
    await page.getByRole("button", { name: "month", exact: true }).click();
    await page.getByText("Sen", { exact: true }).waitFor();
    await assertNoPageOverflow(page, "desktop-work-calendar-month");
    await page.screenshot({ path: `${outDir}/desktop-work-calendar.png`, fullPage: true });
    await page.getByRole("button", { name: "Flows", exact: true }).click();
    await page.getByRole("heading", { name: "Flows", exact: true }).waitFor();
    await page.getByRole("button", { name: "Runs", exact: true }).click();
    await page.getByRole("heading", { name: "Runs", exact: true }).waitFor();

    await goto(page, "/brain", "desktop-brain");
    await page.getByRole("heading", { name: "Brain", exact: true }).waitFor();
    await page.locator('svg[aria-label="Connected Brain graph"]').waitFor();

    await goto(page, "/space", "desktop-space");
    await page.getByRole("heading", { name: "Space", exact: true }).waitFor();
    await page.getByRole("heading", { name: "PCS-06 Notes", exact: true }).waitFor();

    await goto(page, "/ops", "desktop-ops");
    await page
      .getByRole("heading", { name: "Runtime health & telemetry", exact: true })
      .waitFor();
    await page.getByText("Healthy", { exact: true }).waitFor();

    await goto(page, "/settings", "desktop-settings");
    await page.getByRole("heading", { name: "AI & Connections", exact: true }).waitFor();
    await page.getByRole("heading", { name: "AI Providers", exact: true }).waitFor();
    await page.getByText("Not connected", { exact: true }).waitFor();

    const anthropicCard = page.locator("article").filter({ hasText: "Anthropic" }).first();
    await anthropicCard.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByRole("heading", { name: "Anthropic", exact: true }).waitFor();
    await page.getByPlaceholder("Paste API key").fill("stub-credential-pcs06");
    await page.getByRole("button", { name: "Test API key", exact: true }).click();
    await page.getByText(/Credential test PASS:/).waitFor();
    await page.getByRole("button", { name: "Save & activate", exact: true }).click();
    await page.getByText(/API key terverifikasi, terenkripsi/).waitFor();

    const defaultSection = page
      .getByRole("heading", { name: "Default provider & model", exact: true })
      .locator("xpath=ancestor::section[1]");
    const defaultSelects = defaultSection.locator("select");
    await defaultSelects.nth(0).selectOption("openrouter");
    await defaultSelects.nth(1).selectOption("governed");
    await defaultSection.getByRole("button", { name: "Save default", exact: true }).click();
    await page.getByText("Default hosted provider/model saved.", { exact: true }).waitFor();
    if ((await defaultSelects.nth(1).inputValue()) !== "governed") {
      throw new Error("desktop-settings: governed model selection was not retained");
    }
    const selectedModelLabel = await defaultSelects
      .nth(1)
      .locator("option:checked")
      .textContent();
    if (selectedModelLabel?.trim() !== "Governed / Recommended") {
      throw new Error(
        `desktop-settings: expected Governed / Recommended, got ${selectedModelLabel ?? "null"}`,
      );
    }

    await page.getByText("Advanced settings", { exact: true }).click();
    await page.getByRole("heading", { name: "Runtime", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Credential vault", exact: true }).waitFor();
    await page.getByRole("heading", { name: "MCP servers", exact: true }).waitFor();
    await page.screenshot({ path: `${outDir}/desktop-settings.png`, fullPage: true });

    await goto(page, "/flow", "desktop-flow");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText(/Tersimpan sebagai v1/).waitFor();
    const runButton = page.getByRole("button", { name: "Run", exact: true });
    if (!(await runButton.isDisabled()))
      throw new Error("desktop-flow: Run must be blocked before authority readiness");
    await page.getByRole("button", { name: "Prepare authority", exact: true }).click();
    await page.getByText("Approval required", { exact: true }).waitFor();
    if (!(await runButton.isDisabled()))
      throw new Error("desktop-flow: Run must remain blocked while approval is pending");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByText("Execution authority ready", { exact: true }).waitFor();
    if (await runButton.isDisabled())
      throw new Error("desktop-flow: Run must unlock after exact authority becomes ready");
    await runButton.click();
    await page.getByText("COMPLETED", { exact: true }).waitFor();
    await page.getByText("SUCCEEDED", { exact: true }).first().waitFor();
    if (!graphRunStarted) throw new Error("desktop-flow: mocked graph run was not started");
    await page.screenshot({ path: `${outDir}/desktop-flow.png`, fullPage: true });

    checked.assertClean();
  } finally {
    await page.close();
    await context.close();
  }
}

async function runNarrowRoute(path, label, assertion) {
  const context = await browser.newContext({ viewport: { width: 410, height: 844 } });
  await installApiMocks(context);
  const checked = await checkedPage(context, label);
  const page = checked.page;
  try {
    await goto(page, path, label);
    await assertion(page);
    await assertNoPageOverflow(page, label);
    await page.screenshot({ path: `${outDir}/${label}.png`, fullPage: true });
    checked.assertClean();
  } finally {
    await page.close();
    await context.close();
  }
}

async function runStaleProjectSelectionJourney() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(
    ({ key, staleProjectId }) => {
      globalThis.localStorage.setItem(key, staleProjectId);
    },
    { key: PROJECT_STORAGE_KEY, staleProjectId: STALE_PROJECT_ID },
  );
  await installApiMocks(context);
  const checked = await checkedPage(context, "stale-project-selection");
  const page = checked.page;

  async function assertReconciled(path, label) {
    staleProjectOwnerRequests.length = 0;
    await goto(page, path, label);
    const stored = await page.evaluate(
      (key) => globalThis.localStorage.getItem(key),
      PROJECT_STORAGE_KEY,
    );
    if (stored !== project.id) {
      throw new Error(
        `${label}: stale Project was not reconciled to ${project.id}; got ${stored}`,
      );
    }
    if (staleProjectOwnerRequests.length > 0) {
      throw new Error(
        `${label}: stale Project reached owner API ${JSON.stringify(staleProjectOwnerRequests)}`,
      );
    }
  }

  try {
    await assertReconciled("/", "stale-project-ai");
    await page.getByRole("textbox", { name: "Pesan" }).waitFor();

    await assertReconciled("/work", "stale-project-work");
    await page.getByRole("heading", { name: "Work", exact: true }).waitFor();

    await assertReconciled("/brain", "stale-project-brain");
    await page.getByRole("heading", { name: "Brain", exact: true }).waitFor();

    checked.assertClean();
    console.log("PASS stale Project selection reconciliation across Ai/Work/Brain");
  } finally {
    await page.close();
    await context.close();
  }
}

async function runNarrowCoverage() {
  const cases = [
    ["/", "narrow-ai", (page) => page.getByRole("textbox", { name: "Pesan" }).waitFor()],
    [
      "/projects",
      "narrow-projects",
      (page) => page.getByRole("heading", { name: "Projects", exact: true }).waitFor(),
    ],
    [
      "/work",
      "narrow-work",
      async (page) => {
        await page.getByRole("heading", { name: "Work", exact: true }).waitFor();
        await page.getByRole("button", { name: "month", exact: true }).click();
        await page.getByText("Sen", { exact: true }).waitFor();
      },
    ],
    [
      "/brain",
      "narrow-brain",
      (page) => page.getByRole("heading", { name: "Brain", exact: true }).waitFor(),
    ],
    [
      "/space",
      "narrow-space",
      (page) => page.getByRole("heading", { name: "Space", exact: true }).waitFor(),
    ],
    [
      "/ops",
      "narrow-ops",
      (page) =>
        page
          .getByRole("heading", { name: "Runtime health & telemetry", exact: true })
          .waitFor(),
    ],
    [
      "/settings",
      "narrow-settings",
      (page) => page.getByRole("heading", { name: "AI & Connections", exact: true }).waitFor(),
    ],
  ];
  for (const [path, label, assertion] of cases) {
    await runNarrowRoute(path, label, assertion);
  }

  const context = await browser.newContext({ viewport: { width: 410, height: 844 } });
  await installApiMocks(context);
  const checked = await checkedPage(context, "narrow-flow");
  const page = checked.page;
  try {
    await goto(page, "/flow", "narrow-flow-stack");
    await page.getByRole("button", { name: "Stack", exact: true }).waitFor();
    await page.screenshot({ path: `${outDir}/narrow-flow-stack.png`, fullPage: true });
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    const svg = page.locator('svg[aria-label="Flow connections"]');
    await svg.waitFor();
    const overflowX = await svg.evaluate((element) => {
      const wrap = element.parentElement?.parentElement;
      return wrap ? globalThis.getComputedStyle(wrap).overflowX : null;
    });
    if (overflowX !== "auto" && overflowX !== "scroll") {
      throw new Error(
        `narrow-flow-canvas: expected contained horizontal overflow, got ${overflowX}`,
      );
    }
    await assertNoPageOverflow(page, "narrow-flow-canvas");
    await page.screenshot({ path: `${outDir}/narrow-flow-canvas.png`, fullPage: true });
    checked.assertClean();
  } finally {
    await page.close();
    await context.close();
  }
}

try {
  await runDesktopJourney();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
try {
  await runStaleProjectSelectionJourney();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}
try {
  await runNarrowCoverage();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

await browser.close();

if (externalRequests.size > 0) {
  failures.push(
    `External network request(s) observed: ${JSON.stringify([...externalRequests])}`,
  );
}
if (failures.length > 0) {
  console.error("PCS-06 integrated browser acceptance FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PCS-06 integrated browser acceptance PASSED");
