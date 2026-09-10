/**
 * @ecorione/shared-server
 *
 * Fondasi HTTP bersama untuk service Fase 1 (RnD, Context, Connect, Hub). Bukan
 * framework baru — pembungkus tipis di atas Fastify supaya bind host, auth internal,
 * bentuk error, dan client antar-service tidak diimplementasikan ulang empat kali.
 */

export * from "./server.js";
export * from "./errors.js";
export * from "./client.js";
export * from "./validate.js";
export * from "./backup.js";
export * from "./observability.js";
