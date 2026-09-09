import type { FastifyInstance } from "fastify";
import { CapabilityRegistry } from "./capability-registry.js";
import { nowIso } from "./clock.js";
import type { HubDatabase } from "./db.js";
import { HistoryLedger } from "./history-ledger.js";
import { registerMultimodalRoutes } from "./multimodal-http.js";
import { MultimodalRunStore } from "./multimodal-runs.js";
import { HubRepository } from "./repository.js";

export interface RegisterHubMultimodalOptions {
  readonly contextUrl: string;
  readonly connectUrl: string;
  readonly artifactUrl: string;
  readonly internalToken?: string | undefined;
}

/** Register Batch 5 routes on the same Hub DB/boundary as the core server. */
export function registerHubMultimodal(
  app: FastifyInstance,
  db: HubDatabase,
  options: RegisterHubMultimodalOptions,
): void {
  registerMultimodalRoutes(
    app,
    {
      repo: new HubRepository(db),
      history: new HistoryLedger(db),
      authority: new CapabilityRegistry(db),
      runs: new MultimodalRunStore(db),
    },
    { ...options, now: nowIso },
  );
}
