import { readFileSync, writeFileSync } from "node:fs";

function replace(path, from, to) {
  const text = readFileSync(path, "utf8");
  if (!text.includes(from)) throw new Error(`anchor missing: ${path}`);
  writeFileSync(path, text.replace(from, to));
}

replace(
  "services/hub/src/capability-http.ts",
  `import {\n  CapabilityIdempotencyConflictError,\n  CapabilityRegistry,\n  CapabilityUnknownError,\n} from "./capability-registry.js";`,
  `import {\n  CapabilityIdempotencyConflictError,\n  CapabilityUnknownError,\n} from "./capability-registry.js";\nimport type { CapabilityRegistry } from "./capability-registry.js";`,
);

replace(
  "services/hub/src/capability-registry.ts",
  `  type PermissionResource,\n`,
  "",
);
replace(
  "services/hub/src/capability-registry.ts",
  `  type Sensitivity,\n`,
  "",
);

console.log("Batch 4 lint hygiene fixed.");
