/** Local Sync: device pairing + ciphertext relay + loopback MCP HTTPS bridge target. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  DevicePublicKeySchema,
  RelayCiphertextSchema,
  SyncDeviceSchema,
  assertId,
  makeId,
  type RelayCiphertext,
  type SyncDevice,
} from "@ecorione/shared-schema";
import {
  BadGatewayError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  createServer,
  parseOrBadRequest,
} from "@ecorione/shared-server";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isoAfterSeconds, nowIso } from "./clock.js";
import type { SyncDatabase } from "./db.js";

const BootstrapSchema = z.object({
  name: z.string().min(1).max(128),
  publicKey: DevicePublicKeySchema,
});
const PairingCodeSchema = z.object({
  expiresInSeconds: z.number().int().min(60).max(3600).default(600),
});
const PairSchema = z.object({
  code: z.string().min(16).max(256),
  name: z.string().min(1).max(128),
  publicKey: DevicePublicKeySchema,
});
const RelayPostSchema = z.object({
  toDeviceId: z.string(),
  senderEphemeralPublicKey: DevicePublicKeySchema,
  nonce: z.string().min(16).max(128),
  authTag: z.string().min(16).max(128),
  ciphertext: z.string().min(1).max(4_000_000),
});

interface DeviceRow {
  id: string;
  name: string;
  public_key: string;
  token_hash: string;
  created_at: string;
  revoked_at: string | null;
}
interface RelayRow {
  id: string;
  from_device_id: string;
  to_device_id: string;
  sender_ephemeral_public_key: string;
  nonce: string;
  auth_tag: string;
  ciphertext: string;
  created_at: string;
}

export interface BuildSyncServerOptions {
  readonly ownerToken: string;
  readonly connectMcpUrl: string;
  readonly logger?: boolean | undefined;
  readonly clock?: (() => string) | undefined;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function secureEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function bearer(req: FastifyRequest): string {
  const header = req.headers.authorization;
  if (header === undefined || !header.startsWith("Bearer ")) throw new UnauthorizedError();
  return header.slice("Bearer ".length);
}
function toDevice(row: DeviceRow): SyncDevice {
  return SyncDeviceSchema.parse({
    id: row.id,
    name: row.name,
    publicKey: row.public_key,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  });
}
function toRelay(row: RelayRow): RelayCiphertext {
  return RelayCiphertextSchema.parse({
    id: row.id,
    fromDeviceId: row.from_device_id,
    toDeviceId: row.to_device_id,
    senderEphemeralPublicKey: row.sender_ephemeral_public_key,
    nonce: row.nonce,
    authTag: row.auth_tag,
    ciphertext: row.ciphertext,
    createdAt: row.created_at,
  });
}

function requestHeaders(req: FastifyRequest): Headers {
  const headers = new Headers();
  for (const name of [
    "authorization",
    "origin",
    "content-type",
    "mcp-protocol-version",
    "mcp-method",
    "mcp-name",
  ]) {
    const value = req.headers[name];
    if (typeof value === "string") headers.set(name, value);
  }
  return headers;
}

export function buildSyncServer(
  db: SyncDatabase,
  options: BuildSyncServerOptions,
): FastifyInstance {
  const app = createServer({ name: "sync", logger: options.logger });
  const clock = options.clock ?? nowIso;

  function authenticate(req: FastifyRequest): SyncDevice {
    const tokenHash = sha256(bearer(req));
    const row = db.raw
      .prepare("SELECT * FROM devices WHERE token_hash=? AND revoked_at IS NULL")
      .get(tokenHash) as DeviceRow | undefined;
    if (row === undefined)
      throw new UnauthorizedError("Device token tidak valid atau sudah dicabut.");
    return toDevice(row);
  }

  function issueDevice(
    name: string,
    publicKey: string,
    now: string,
  ): { readonly device: SyncDevice; readonly token: string } {
    const id = makeId("device");
    const token = randomBytes(32).toString("base64url");
    db.raw
      .prepare(
        "INSERT INTO devices (id,name,public_key,token_hash,created_at,revoked_at) VALUES (?,?,?,?,?,NULL)",
      )
      .run(id, name, publicKey, sha256(token), now);
    return {
      device: SyncDeviceSchema.parse({ id, name, publicKey, createdAt: now, revokedAt: null }),
      token,
    };
  }

  app.post("/v1/devices/bootstrap", async (req, reply) => {
    const owner = req.headers["x-ecorione-owner-token"];
    if (typeof owner !== "string" || !secureEqual(owner, options.ownerToken))
      throw new UnauthorizedError("Owner token salah.");
    const count = (db.raw.prepare("SELECT COUNT(*) AS n FROM devices").get() as { n: number })
      .n;
    if (count !== 0)
      throw new ConflictError("Bootstrap hanya boleh dipakai saat belum ada device terdaftar.");
    const body = parseOrBadRequest(BootstrapSchema, req.body);
    return await reply.code(201).send(issueDevice(body.name, body.publicKey, clock()));
  });

  app.get("/v1/devices", async (req) => {
    authenticate(req);
    const rows = db.raw
      .prepare("SELECT * FROM devices WHERE revoked_at IS NULL ORDER BY created_at ASC,id ASC")
      .all() as DeviceRow[];
    return { devices: rows.map(toDevice) };
  });

  app.post("/v1/pairing-codes", async (req, reply) => {
    const device = authenticate(req);
    const body = parseOrBadRequest(PairingCodeSchema, req.body ?? {});
    const now = clock();
    const code = randomBytes(18).toString("base64url");
    const expiresAt = isoAfterSeconds(now, body.expiresInSeconds);
    db.raw
      .prepare(
        "INSERT INTO pairing_codes (code_hash,created_by_device_id,expires_at,consumed_at) VALUES (?,?,?,NULL)",
      )
      .run(sha256(code), device.id, expiresAt);
    return await reply.code(201).send({ code, expiresAt });
  });

  app.post("/v1/devices/pair", async (req, reply) => {
    const body = parseOrBadRequest(PairSchema, req.body);
    const now = clock();
    const codeHash = sha256(body.code);
    const row = db.raw
      .prepare("SELECT expires_at,consumed_at FROM pairing_codes WHERE code_hash=?")
      .get(codeHash) as { expires_at: string; consumed_at: string | null } | undefined;
    if (
      row === undefined ||
      row.consumed_at !== null ||
      Date.parse(row.expires_at) <= Date.parse(now)
    ) {
      throw new BadRequestError("Pairing code tidak valid, sudah dipakai, atau kedaluwarsa.");
    }
    const result = db.raw.transaction(() => {
      const issued = issueDevice(body.name, body.publicKey, now);
      db.raw
        .prepare(
          "UPDATE pairing_codes SET consumed_at=? WHERE code_hash=? AND consumed_at IS NULL",
        )
        .run(now, codeHash);
      return issued;
    })();
    return await reply.code(201).send(result);
  });

  app.post("/v1/relay", async (req, reply) => {
    const from = authenticate(req);
    const body = parseOrBadRequest(RelayPostSchema, req.body);
    const toDeviceId = assertId("device", body.toDeviceId);
    const destination = db.raw
      .prepare("SELECT id FROM devices WHERE id=? AND revoked_at IS NULL")
      .get(toDeviceId) as { id: string } | undefined;
    if (destination === undefined)
      throw new NotFoundError(`Device tujuan tidak ditemukan: ${toDeviceId}`);
    const message = RelayCiphertextSchema.parse({
      id: makeId("event"),
      fromDeviceId: from.id,
      toDeviceId,
      senderEphemeralPublicKey: body.senderEphemeralPublicKey,
      nonce: body.nonce,
      authTag: body.authTag,
      ciphertext: body.ciphertext,
      createdAt: clock(),
    });
    db.raw
      .prepare(
        `INSERT INTO relay_messages
      (id,from_device_id,to_device_id,sender_ephemeral_public_key,nonce,auth_tag,ciphertext,created_at,acknowledged_at)
      VALUES (?,?,?,?,?,?,?,?,NULL)`,
      )
      .run(
        message.id,
        message.fromDeviceId,
        message.toDeviceId,
        message.senderEphemeralPublicKey,
        message.nonce,
        message.authTag,
        message.ciphertext,
        message.createdAt,
      );
    return await reply.code(201).send(message);
  });

  app.get("/v1/relay", async (req) => {
    const device = authenticate(req);
    const rows = db.raw
      .prepare(
        "SELECT * FROM relay_messages WHERE to_device_id=? AND acknowledged_at IS NULL ORDER BY created_at ASC,id ASC LIMIT 200",
      )
      .all(device.id) as RelayRow[];
    return { messages: rows.map(toRelay) };
  });

  app.post<{ Params: { id: string } }>("/v1/relay/:id/ack", async (req) => {
    const device = authenticate(req);
    const id = assertId("event", req.params.id);
    const changes = db.raw
      .prepare(
        "UPDATE relay_messages SET acknowledged_at=? WHERE id=? AND to_device_id=? AND acknowledged_at IS NULL",
      )
      .run(clock(), id, device.id).changes;
    if (changes === 0)
      throw new NotFoundError(`Relay message tidak ditemukan untuk device ini: ${id}`);
    return { acknowledged: true, id };
  });

  async function forward(
    req: FastifyRequest,
    reply: FastifyReply,
    path: string,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${options.connectMcpUrl}${path}`, {
        method: req.method,
        headers: requestHeaders(req),
        ...(req.method === "POST" ? { body: JSON.stringify(req.body ?? {}) } : {}),
      });
    } catch (error) {
      throw new BadGatewayError(
        `Connect MCP tidak bisa dijangkau: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const contentType = response.headers.get("content-type");
    const wwwAuthenticate = response.headers.get("www-authenticate");
    if (contentType !== null) reply.header("content-type", contentType);
    if (wwwAuthenticate !== null) reply.header("www-authenticate", wwwAuthenticate);
    const text = await response.text();
    return await reply
      .code(response.status)
      .send(
        contentType?.includes("application/json") === true && text.length > 0
          ? JSON.parse(text)
          : text,
      );
  }

  app.get("/.well-known/oauth-protected-resource", async (req, reply) =>
    forward(req, reply, "/.well-known/oauth-protected-resource"),
  );
  app.get("/.well-known/oauth-protected-resource/mcp", async (req, reply) =>
    forward(req, reply, "/.well-known/oauth-protected-resource/mcp"),
  );
  app.get("/mcp", async (req, reply) => forward(req, reply, "/mcp"));
  app.post("/mcp", async (req, reply) => forward(req, reply, "/mcp"));

  return app;
}
