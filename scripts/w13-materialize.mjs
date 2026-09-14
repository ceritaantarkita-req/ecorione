#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

function update(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: no change produced`);
  writeFileSync(path, after);
}

function replaceOne(text, oldValue, newValue, label) {
  const index = text.indexOf(oldValue);
  if (index === -1) throw new Error(`${label}: expected source fragment not found`);
  if (text.indexOf(oldValue, index + oldValue.length) !== -1) {
    throw new Error(`${label}: source fragment is not unique`);
  }
  return text.slice(0, index) + newValue + text.slice(index + oldValue.length);
}

update("services/connect/src/runtime-settings.ts", (text) => {
  text = replaceOne(
    text,
    'import { z } from "zod";\nimport { HostedProviderIdSchema, type HostedProviderId } from "./provider-types.js";',
    'import { z } from "zod";\nimport {\n  LocalModelDigestSchema,\n  type LocalModelDigest,\n} from "./local-model-identity.js";\nimport { HostedProviderIdSchema, type HostedProviderId } from "./provider-types.js";',
    "runtime settings identity import",
  );
  text = replaceOne(
    text,
    '    localModelTag: z.string().min(1).max(256),\n    hostedCallsEnabled: z.boolean(),',
    '    localModelTag: z.string().min(1).max(256),\n    localModelDigest: LocalModelDigestSchema.nullable().default(null),\n    hostedCallsEnabled: z.boolean(),',
    "runtime settings digest field",
  );
  return replaceOne(
    text,
    '      localModelTag: string;\n      hostedCallsEnabled: boolean;',
    '      localModelTag: string;\n      localModelDigest?: LocalModelDigest | null | undefined;\n      hostedCallsEnabled: boolean;',
    "runtime settings defaults digest",
  );
});

update("services/connect/src/main.ts", (text) => {
  text = replaceOne(
    text,
    'import { FileCredentialVault } from "./credential-vault.js";\nimport { buildConnectServer } from "./http.js";',
    'import { FileCredentialVault } from "./credential-vault.js";\nimport { buildConnectServer } from "./http.js";\nimport { parseOptionalLocalModelDigest } from "./local-model-identity.js";',
    "main identity import",
  );
  text = replaceOne(
    text,
    'const localModelTag = process.env.ECORIONE_LOCAL_MODEL ?? "qwen3:8b-instruct-q4_K_M";\nconst hostedCallsAllowedByOperator',
    'const localModelTag = process.env.ECORIONE_LOCAL_MODEL ?? "qwen3:8b-instruct-q4_K_M";\nconst localModelDigest = parseOptionalLocalModelDigest(process.env.ECORIONE_LOCAL_MODEL_DIGEST);\nconst hostedCallsAllowedByOperator',
    "main digest env",
  );
  text = replaceOne(
    text,
    '  localBaseUrl,\n  localModelTag,\n  hostedCallsEnabled: hostedCallsAllowedByOperator,',
    '  localBaseUrl,\n  localModelTag,\n  localModelDigest,\n  hostedCallsEnabled: hostedCallsAllowedByOperator,',
    "main runtime defaults digest",
  );
  return replaceOne(
    text,
    '  localBaseUrl,\n  localModelTag,\n  hostedCallsEnabled: hostedCallsAllowedByOperator,\n  spendBudget,',
    '  localBaseUrl,\n  localModelTag,\n  localModelDigest,\n  hostedCallsEnabled: hostedCallsAllowedByOperator,\n  spendBudget,',
    "main server digest",
  );
});

update("services/connect/src/complete.ts", (text) => {
  text = replaceOne(
    text,
    'import { cacheKey, type ExactMatchCache } from "./cache.js";\nimport type { ProviderCredentialReader } from "./credential-vault.js";',
    'import { cacheKey, type ExactMatchCache } from "./cache.js";\nimport type { ProviderCredentialReader } from "./credential-vault.js";\nimport {\n  localModelIdentity,\n  type LocalModelDigest,\n} from "./local-model-identity.js";',
    "complete identity import",
  );
  text = replaceOne(
    text,
    '  readonly localBaseUrl: string;\n  readonly localModelTag: string;\n  readonly cache: ExactMatchCache;',
    '  readonly localBaseUrl: string;\n  readonly localModelTag: string;\n  readonly localModelDigest?: LocalModelDigest | null | undefined;\n  readonly cache: ExactMatchCache;',
    "complete deps digest",
  );
  text = replaceOne(
    text,
    '  /** Runtime identity reported by provider/runtime. */\n  readonly responseModel: string;\n  readonly cacheHit: boolean;',
    '  /** Runtime identity reported by provider/runtime. */\n  readonly responseModel: string;\n  /** Stable identity used for durable evidence/cache boundaries. */\n  readonly modelIdentity: string;\n  /** Local identity is pinned only when an explicit immutable digest is configured. */\n  readonly modelIdentityPinned: boolean;\n  readonly cacheHit: boolean;',
    "complete result identity",
  );
  text = replaceOne(
    text,
    '  const providerIdentity = local ? "local" : hostedProvider;\n  const model = local ? deps.localModelTag : decision.model;\n  const modelCacheIdentity = local\n    ? `${providerIdentity}:${deps.localRuntime ?? "openai-compatible"}:${deps.localBaseUrl}:${model}:prompt-v${LOCAL_PROMPT_FRAMING_VERSION}`\n    : `${providerIdentity}:${model}`;\n  const key = cacheKey({',
    '  const providerIdentity = local ? "local" : hostedProvider;\n  const model = local ? deps.localModelTag : decision.model;\n  const localIdentity = local\n    ? localModelIdentity({\n        runtime: deps.localRuntime ?? "openai-compatible",\n        modelTag: deps.localModelTag,\n        digest: deps.localModelDigest,\n      })\n    : undefined;\n  const modelIdentity = localIdentity?.id ?? `${providerIdentity}:${model}`;\n  const modelIdentityPinned = localIdentity?.pinned ?? true;\n  const allowExactCache = !local || modelIdentityPinned;\n  const modelCacheIdentity = local\n    ? `${modelIdentity}:${deps.localBaseUrl}:prompt-v${LOCAL_PROMPT_FRAMING_VERSION}`\n    : modelIdentity;\n  const key = cacheKey({',
    "complete cache identity",
  );
  text = replaceOne(
    text,
    '  const cached = deps.cache.get(key, nowMs);',
    '  const cached = allowExactCache ? deps.cache.get(key, nowMs) : null;',
    "complete cache read policy",
  );
  text = replaceOne(
    text,
    '    deps.cache.set(key, { reply, model: responseModel, usage }, nowMs);\n    cacheHit = false;\n  } else {',
    '    if (allowExactCache) deps.cache.set(key, { reply, model: responseModel, usage }, nowMs);\n    cacheHit = false;\n  } else {',
    "complete local cache write policy",
  );
  return replaceOne(
    text,
    '    pricingModel: decision.model,\n    responseModel,\n    cacheHit,',
    '    pricingModel: decision.model,\n    responseModel,\n    modelIdentity,\n    modelIdentityPinned,\n    cacheHit,',
    "complete result identity return",
  );
});

update("services/connect/src/http.ts", (text) => {
  text = replaceOne(
    text,
    'import { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";',
    'import type { LocalModelDigest } from "./local-model-identity.js";\nimport { inferMultimodal, type MultimodalAdapter } from "./multimodal.js";',
    "http identity import",
  );
  text = replaceOne(
    text,
    '  readonly localBaseUrl: string;\n  readonly localModelTag: string;\n  readonly hostedCallsEnabled?: boolean | undefined;',
    '  readonly localBaseUrl: string;\n  readonly localModelTag: string;\n  readonly localModelDigest?: LocalModelDigest | null | undefined;\n  readonly hostedCallsEnabled?: boolean | undefined;',
    "http options digest",
  );
  text = replaceOne(
    text,
    '    localBaseUrl: options.localBaseUrl,\n    localModelTag: options.localModelTag,\n    hostedCallsEnabled: options.hostedCallsEnabled ?? true,',
    '    localBaseUrl: options.localBaseUrl,\n    localModelTag: options.localModelTag,\n    localModelDigest: options.localModelDigest ?? null,\n    hostedCallsEnabled: options.hostedCallsEnabled ?? true,',
    "http defaults digest",
  );
  text = replaceOne(
    text,
    '    localBaseUrl: runtime.localBaseUrl,\n    localModelTag: runtime.localModelTag,\n    cache,',
    '    localBaseUrl: runtime.localBaseUrl,\n    localModelTag: runtime.localModelTag,\n    localModelDigest: runtime.localModelDigest,\n    cache,',
    "http current deps digest",
  );
  text = replaceOne(
    text,
    '      cache: result.cacheHit ? "hit" : "miss",\n    };',
    '      cache: result.cacheHit ? "hit" : "miss",\n      modelIdentityPinned: result.modelIdentityPinned ? "true" : "false",\n    };',
    "http metric identity state",
  );
  text = replaceOne(
    text,
    '          responseModel: result.responseModel,\n          cacheHit: result.cacheHit,',
    '          responseModel: result.responseModel,\n          modelIdentity: result.modelIdentity,\n          modelIdentityPinned: result.modelIdentityPinned,\n          cacheHit: result.cacheHit,',
    "credential test identity",
  );
  return replaceOne(
    text,
    '        responseModel: result.responseModel,\n        cacheHit: result.cacheHit,',
    '        responseModel: result.responseModel,\n        modelIdentity: result.modelIdentity,\n        modelIdentityPinned: result.modelIdentityPinned,\n        cacheHit: result.cacheHit,',
    "provider canary identity",
  );
});

update("apps/ai/app/settings/page.tsx", (text) => {
  text = replaceOne(
    text,
    '    localBaseUrl: string;\n    localModelTag: string;\n    hostedCallsEnabled: boolean;',
    '    localBaseUrl: string;\n    localModelTag: string;\n    localModelDigest: string | null;\n    hostedCallsEnabled: boolean;',
    "settings snapshot digest",
  );
  text = replaceOne(
    text,
    '        provider: string;\n        model: string;\n      }>("/api/settings/ops/provider-canary", {',
    '        provider: string;\n        model: string;\n        modelIdentity: string;\n        modelIdentityPinned: boolean;\n      }>("/api/settings/ops/provider-canary", {',
    "settings canary identity type",
  );
  text = replaceOne(
    text,
    '        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms`,',
    '        `Canary ${result.pass ? "PASS" : "FAIL"}: ${result.provider}/${result.model} ${result.latencyMs.toFixed(1)}ms · identity ${result.modelIdentityPinned ? "PINNED" : "UNPINNED"}`,',
    "settings canary identity status",
  );
  text = replaceOne(
    text,
    '            <label className={styles.wide}>\n              Local base URL',
    '            <label className={styles.wide}>\n              Local model SHA-256\n              <input\n                placeholder="sha256:64-hex"\n                value={runtime.settings.localModelDigest ?? ""}\n                disabled={pendingAction !== null}\n                onChange={(event) =>\n                  setRuntime({\n                    ...runtime,\n                    settings: {\n                      ...runtime.settings,\n                      localModelDigest:\n                        event.target.value.trim().length === 0 ? null : event.target.value,\n                    },\n                  })\n                }\n              />\n            </label>\n            <label className={styles.wide}>\n              Local base URL',
    "settings digest input",
  );
  return replaceOne(
    text,
    '            {mutableLocalModel ? (\n              <p className={`${styles.warning} ${styles.wide}`}>\n                Local model memakai alias mutable <code>{runtime.settings.localModelTag}</code>.\n                Cocok untuk rehearsal, belum immutable production identity.\n              </p>\n            ) : null}\n            <p className={`${styles.muted} ${styles.wide}`}>',
    '            {mutableLocalModel ? (\n              <p className={`${styles.warning} ${styles.wide}`}>\n                Local model memakai alias mutable <code>{runtime.settings.localModelTag}</code>.\n                Cocok untuk rehearsal, belum immutable production identity.\n              </p>\n            ) : null}\n            {runtime.settings.localModelDigest === null ? (\n              <p className={`${styles.warning} ${styles.wide}`}>\n                Local model identity belum dipin dengan SHA-256. Chat tetap bisa dipakai, tetapi\n                exact-cache lokal dan durable evidence tidak dianggap reproducible.\n              </p>\n            ) : (\n              <p className={`${styles.muted} ${styles.wide}`}>\n                Local model identity dipin ke <code>{runtime.settings.localModelDigest}</code>.\n              </p>\n            )}\n            <p className={`${styles.muted} ${styles.wide}`}>',
    "settings identity guidance",
  );
});

update("scripts/local-ux-product-evidence.mjs", (text) => {
  text = replaceOne(
    text,
    '  if (\n    typeof settings.localModelTag !== "string" ||\n    settings.localModelTag.trim().length === 0\n  ) {\n    throw new Error("Runtime settings tidak melaporkan localModelTag yang valid.");\n  }\n  return {\n    hostedCallsEnabled: false,\n    localRuntime: settings.localRuntime,\n    localModelTag: settings.localModelTag,\n    mutableModelAlias: /(^|[:@])latest$/i.test(settings.localModelTag.trim()),\n  };',
    '  if (\n    typeof settings.localModelTag !== "string" ||\n    settings.localModelTag.trim().length === 0\n  ) {\n    throw new Error("Runtime settings tidak melaporkan localModelTag yang valid.");\n  }\n  if (\n    typeof settings.localModelDigest !== "string" ||\n    !/^sha256:[0-9a-f]{64}$/.test(settings.localModelDigest)\n  ) {\n    throw new Error(\n      "Runtime settings belum memiliki localModelDigest SHA-256 yang pinned untuk durable UX evidence.",\n    );\n  }\n  return {\n    hostedCallsEnabled: false,\n    localRuntime: settings.localRuntime,\n    localModelTag: settings.localModelTag,\n    localModelDigest: settings.localModelDigest,\n    modelIdentity: `local:${settings.localRuntime}:${settings.localModelTag}@${settings.localModelDigest}`,\n    mutableModelAlias: /(^|[:@])latest$/i.test(settings.localModelTag.trim()),\n  };',
    "UX evidence digest requirement",
  );
  return text;
});

update("docs/adr/0014-pinned-models.md", (text) => {
  return replaceOne(
    text,
    'Alias model dilarang di kode dan konfigurasi. `assertPinnedModel()` menolak apa pun yang\ncocok `-latest`, dan CI punya gerbang grep terpisah untuk itu.\n\nIndex vektor menyimpan identitas model embedding dan hanya menyentuh satu model.',
    'Alias model dilarang di kode dan konfigurasi. `assertPinnedModel()` menolak apa pun yang\ncocok `-latest`, dan CI punya gerbang grep terpisah untuk itu.\n\nUntuk runtime lokal OpenAI-compatible, `localModelTag` adalah selector request, bukan bukti\nidentitas immutable. Durable evidence/cache identity harus membawa `localModelDigest` SHA-256.\nJika digest belum dikonfigurasi, local chat tetap boleh berjalan tetapi exact-match cache lokal\ndibypass dan hasil harus dilabeli `modelIdentityPinned=false`. Digest adalah provenance yang\ndideklarasikan operator; runtime generik yang tidak memiliki provenance API tidak boleh diklaim\nmelakukan cryptographic attestation otomatis terhadap bytes model.\n\nIndex vektor menyimpan identitas model embedding dan hanya menyentuh satu model.',
    "ADR-14 local identity rule",
  );
});

update("docs/active-work-plan.md", (text) => {
  text = replaceOne(
    text,
    '| W13 | Immutable local model identity | TODO | Runtime/evidence memakai identity/version/digest reproducible; mutable alias tidak dipakai untuk durable claims. |',
    '| W13 | Immutable local model identity | **STARTED — IDENTITY CONTRACT IMPLEMENTED** | Runtime/evidence memakai selector + SHA-256 digest terpisah; unpinned local runtime tidak memakai exact-cache untuk durable reuse. |',
    "W13 queue status",
  );
  const marker = '\n## 10. Claim boundary\n';
  if (!text.includes(marker)) throw new Error("W13 docs claim-boundary marker not found");
  const log = `\n### 2026-09-14 — W13 — STARTED — IDENTITY CONTRACT IMPLEMENTED\n\n**Changed candidate:** local model selector dan immutable identity dipisahkan. Runtime settings mendapat optional \`localModelDigest\` SHA-256; completion/canary mengekspos \`modelIdentity\` + \`modelIdentityPinned\`; exact-cache lokal dibypass jika digest belum dipin; Settings menyediakan field digest tanpa redesign; durable UX evidence menolak runtime lokal tanpa pinned digest.\n\n**Claim boundary:** digest adalah provenance yang dikonfigurasi operator. Generic OpenAI-compatible runtime tidak selalu memiliki endpoint provenance, jadi ECORIONE tidak mengklaim cryptographic attestation otomatis terhadap bytes model.\n`;
  return text.replace(marker, log + marker);
});

console.log("W13 materialized");
