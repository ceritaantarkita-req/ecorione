import { afterEach, describe, expect, it } from "vitest";
import { decryptFromPeer, encryptForPeer, generateDeviceKeyPair } from "./crypto.js";
import { openSyncDatabase, type SyncDatabase } from "./db.js";
import { buildSyncServer } from "./http.js";

const NOW = "2026-09-09T00:00:00.000Z";
const OWNER = "owner-token-for-sync-tests-123456789";
let db: SyncDatabase | undefined;
afterEach(() => { db?.close(); db = undefined; });

async function setupPair() {
  db = openSyncDatabase(":memory:");
  const app = buildSyncServer(db, { ownerToken: OWNER, connectMcpUrl: "http://127.0.0.1:65535", clock: () => NOW });
  const a = generateDeviceKeyPair();
  const b = generateDeviceKeyPair();
  const bootstrap = await app.inject({
    method: "POST", url: "/v1/devices/bootstrap",
    headers: { "x-ecorione-owner-token": OWNER },
    payload: { name: "laptop", publicKey: a.publicKey },
  });
  expect(bootstrap.statusCode).toBe(201);
  const first = JSON.parse(bootstrap.body) as { device: { id: string }; token: string };
  const codeResponse = await app.inject({
    method: "POST", url: "/v1/pairing-codes",
    headers: { authorization: `Bearer ${first.token}` }, payload: {},
  });
  const pairing = JSON.parse(codeResponse.body) as { code: string };
  const pair = await app.inject({
    method: "POST", url: "/v1/devices/pair",
    payload: { code: pairing.code, name: "phone", publicKey: b.publicKey },
  });
  expect(pair.statusCode).toBe(201);
  const second = JSON.parse(pair.body) as { device: { id: string }; token: string };
  return { app, a, b, first, second, code: pairing.code };
}

describe("Sync device relay", () => {
  it("bootstrap membutuhkan owner token dan hanya bisa sekali", async () => {
    db = openSyncDatabase(":memory:");
    const app = buildSyncServer(db, { ownerToken: OWNER, connectMcpUrl: "http://127.0.0.1:65535", clock: () => NOW });
    const key = generateDeviceKeyPair();
    const denied = await app.inject({ method: "POST", url: "/v1/devices/bootstrap", payload: { name: "x", publicKey: key.publicKey } });
    expect(denied.statusCode).toBe(401);
    const first = await app.inject({ method: "POST", url: "/v1/devices/bootstrap", headers: { "x-ecorione-owner-token": OWNER }, payload: { name: "x", publicKey: key.publicKey } });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({ method: "POST", url: "/v1/devices/bootstrap", headers: { "x-ecorione-owner-token": OWNER }, payload: { name: "y", publicKey: key.publicKey } });
    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it("pairing code sekali pakai", async () => {
    const { app, b, code } = await setupPair();
    const replay = await app.inject({ method: "POST", url: "/v1/devices/pair", payload: { code, name: "replay", publicKey: b.publicKey } });
    expect(replay.statusCode).toBe(400);
    await app.close();
  });

  it("relay menyimpan ciphertext saja dan recipient dapat decrypt E2E", async () => {
    const { app, b, first, second } = await setupPair();
    const plaintext = Buffer.from("rahasia antar device", "utf8");
    const encrypted = encryptForPeer(b.publicKey, plaintext);
    const sent = await app.inject({
      method: "POST", url: "/v1/relay",
      headers: { authorization: `Bearer ${first.token}` },
      payload: { toDeviceId: second.device.id, ...encrypted },
    });
    expect(sent.statusCode).toBe(201);
    const stored = db?.raw.prepare("SELECT ciphertext FROM relay_messages").get() as { ciphertext: string };
    expect(stored.ciphertext).not.toContain(plaintext.toString("utf8"));

    const inbox = await app.inject({ method: "GET", url: "/v1/relay", headers: { authorization: `Bearer ${second.token}` } });
    const parsed = JSON.parse(inbox.body) as { messages: Array<{ id: string; senderEphemeralPublicKey: string; nonce: string; authTag: string; ciphertext: string }> };
    expect(parsed.messages).toHaveLength(1);
    const message = parsed.messages[0];
    if (message === undefined) throw new Error("relay message missing");
    const decrypted = decryptFromPeer(b.privateKey, message);
    expect(decrypted.toString("utf8")).toBe(plaintext.toString("utf8"));

    const ack = await app.inject({ method: "POST", url: `/v1/relay/${message.id}/ack`, headers: { authorization: `Bearer ${second.token}` } });
    expect(ack.statusCode).toBe(200);
    const empty = await app.inject({ method: "GET", url: "/v1/relay", headers: { authorization: `Bearer ${second.token}` } });
    expect((JSON.parse(empty.body) as { messages: unknown[] }).messages).toHaveLength(0);
    await app.close();
  });
});
