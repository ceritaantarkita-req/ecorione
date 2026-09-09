/**
 * Entrypoint produksi Context. Baca env, buka DB, jalankan server.
 */

import { resolve } from "node:path";
import { makeId } from "@ecorione/shared-schema";
import { bindHost, httpJson } from "@ecorione/shared-server";
import { registerAccessRoutes } from "./access-http.js";
import { registerArtifactRoutes } from "./artifact-routes.js";
import { nowIso } from "./clock.js";
import { openContextDatabase } from "./db.js";
import { buildContextServer } from "./http.js";
import { ContextRepository } from "./repository.js";
import { createVectorIndex } from "./vector.js";

/**
 * Default **hanya** dipakai kalau `ECORIONE_DB_PATH` kosong di `.env` — dijangkarkan ke
 * lokasi modul ini (bukan `process.cwd()`) supaya `pnpm dev` tetap menulis ke satu
 * `./data/` di akar repo, persis seperti yang didokumentasikan `.env.example`, apa pun
 * direktori kerja saat proses ini dijalankan (`pnpm --filter` mengubah cwd ke folder
 * paket, bukan akar repo — default relatif-ke-cwd akan diam-diam mencar ke
 * `services/context/data/`).
 */
const DEFAULT_DB_PATH = resolve(import.meta.dirname, "../../../data/ecorione.db");

const port = Number(process.env.ECORIONE_CONTEXT_PORT ?? "17022");
const dbPath = process.env.ECORIONE_DB_PATH ?? DEFAULT_DB_PATH;
const token = process.env.ECORIONE_INTERNAL_TOKEN || undefined;
const connectUrl = process.env.ECORIONE_CONNECT_URL ?? "http://127.0.0.1:17023";

const db = openContextDatabase({ path: dbPath });
const vectors = createVectorIndex(db.raw, {
  dim: 256,
  model: process.env.ECORIONE_EMBEDDING_MODEL ?? "none",
});
const repo = new ContextRepository(db, vectors);

interface CompleteResponse {
  readonly reply: string;
}

/**
 * Panggilan model lokal untuk konsolidasi selalu lewat Connect (`docs/api-fase1.md`
 * §Context "Konsolidasi") — bukan langsung ke Ollama — supaya cost ledger dan trace
 * tetap satu jalur untuk semua panggilan model.
 */
async function extractLocal(prompt: string): Promise<string> {
  const res = await httpJson<CompleteResponse>(`${connectUrl}/v1/complete`, {
    token,
    body: {
      target: "local",
      prefix: {
        systemPrompt:
          "Kamu pengekstrak fakta untuk memori ecorione. Jawab hanya dengan JSON array sesuai instruksi di pesan pengguna.",
        toolDefinitions: [],
        coreMemory: { blocks: [] },
      },
      dynamicText: "",
      userMessage: prompt,
      sensitivity: "INTERNAL",
      operationId: makeId("operation"),
      now: nowIso(),
    },
  });
  return res.reply;
}

const app = buildContextServer(repo, vectors, { token, logger: true, extractLocal });
registerArtifactRoutes(app, repo);
registerAccessRoutes(app, repo);

app
  .listen({ port, host: bindHost() })
  .then(() => {
    app.log.info(`Context jalan di http://${bindHost()}:${String(port)}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
