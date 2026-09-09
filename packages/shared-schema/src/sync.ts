/** Cross-module Sync contracts. Sync transports ciphertext only; plaintext never enters relay storage. */
import { z } from "zod";
import { DeviceIdSchema, EventIdSchema } from "./ids.js";

export const DevicePublicKeySchema = z.string().min(32).max(8192);
export type DevicePublicKey = z.infer<typeof DevicePublicKeySchema>;

export const RelayCiphertextSchema = z.object({
  id: EventIdSchema,
  fromDeviceId: DeviceIdSchema,
  toDeviceId: DeviceIdSchema,
  senderEphemeralPublicKey: DevicePublicKeySchema,
  nonce: z.string().min(16).max(128),
  authTag: z.string().min(16).max(128),
  ciphertext: z.string().min(1).max(4_000_000),
  createdAt: z.string().datetime({ offset: false }),
});
export type RelayCiphertext = z.infer<typeof RelayCiphertextSchema>;

export const SyncDeviceSchema = z.object({
  id: DeviceIdSchema,
  name: z.string().min(1).max(128),
  publicKey: DevicePublicKeySchema,
  createdAt: z.string().datetime({ offset: false }),
  revokedAt: z.string().datetime({ offset: false }).nullable().default(null),
});
export type SyncDevice = z.infer<typeof SyncDeviceSchema>;
