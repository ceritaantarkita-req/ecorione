/** Device-side E2E helpers. Sync server never receives a private key or plaintext. */
import {
  createCipheriv,
  createDecipheriv,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";

const INFO = Buffer.from("ecorione-sync-v1", "utf8");

export interface DeviceKeyPair {
  readonly publicKey: string;
  readonly privateKey: string;
}
export interface EncryptedPayload {
  readonly senderEphemeralPublicKey: string;
  readonly nonce: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

export function generateDeviceKeyPair(): DeviceKeyPair {
  const pair = generateKeyPairSync("x25519");
  return {
    publicKey: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

function deriveKey(privateKeyPem: string, publicKeyPem: string): Buffer {
  const secret = diffieHellman({
    privateKey: createPrivateKey(privateKeyPem),
    publicKey: createPublicKey(publicKeyPem),
  });
  return Buffer.from(hkdfSync("sha256", secret, Buffer.alloc(0), INFO, 32));
}

export function encryptForPeer(peerPublicKey: string, plaintext: Buffer): EncryptedPayload {
  const ephemeral = generateKeyPairSync("x25519");
  const ephemeralPrivate = ephemeral.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  const key = deriveKey(ephemeralPrivate, peerPublicKey);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    senderEphemeralPublicKey: ephemeral.publicKey
      .export({ type: "spki", format: "pem" })
      .toString(),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptFromPeer(privateKey: string, payload: EncryptedPayload): Buffer {
  const key = deriveKey(privateKey, payload.senderEphemeralPublicKey);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.nonce, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
}
