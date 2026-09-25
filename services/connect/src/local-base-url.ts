/**
 * Batas jangkauan `localBaseUrl`.
 *
 * Target "Local" adalah janji privasi ECORIONE: prompt beserta konteks yang terhidrasi
 * ke dalamnya tidak meninggalkan mesin. Sebelum audit 2026-09-14, validasi `localBaseUrl`
 * hanya menolak skema non-HTTP(S), credential inline, dan fragment — host-nya bebas. Satu
 * salah ketik saja (apalagi satu request lintas-origin) sudah cukup untuk mengirim seluruh
 * percakapan "Local" ke server orang lain, sementara UI tetap menulis "Local".
 *
 * Karena itu host wajib berada di jangkauan yang tidak bisa meninggalkan mesin/LAN, kecuali
 * operator menyatakan sebaliknya lewat `ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC=1`. Klasifikasi
 * dilakukan murni sintaktis (tanpa resolusi DNS) supaya tetap deterministik dan bisa diuji;
 * konsekuensinya nama host tak-berlabel-publik seperti `host.docker.internal` dipercaya
 * berdasarkan bentuknya, bukan hasil resolusinya.
 */

export type LocalHostReach = "loopback" | "private" | "link-local" | "private-name" | "public";

const PRIVATE_NAME_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"] as const;

function classifyIpv4(octets: readonly number[]): LocalHostReach {
  const [a, b] = octets as [number, number, number, number];
  if (a === 127 || a === 0) return "loopback";
  if (a === 169 && b === 254) return "link-local";
  if (a === 10) return "private";
  if (a === 172 && b >= 16 && b <= 31) return "private";
  if (a === 192 && b === 168) return "private";
  // 100.64.0.0/10 — CGNAT, dipakai Tailscale dan sejenisnya untuk mesh pribadi.
  if (a === 100 && b >= 64 && b <= 127) return "private";
  return "public";
}

function parseIpv4(host: string): readonly number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/u.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets;
}

function classifyIpv6(inner: string): LocalHostReach {
  const lower = inner.toLowerCase();
  const zoneless = lower.split("%")[0] ?? lower;
  if (zoneless === "::1" || zoneless === "::") return "loopback";

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(zoneless);
  if (mapped !== null) {
    const octets = parseIpv4(mapped[1] as string);
    return octets === null ? "public" : classifyIpv4(octets);
  }

  const firstGroup = zoneless.startsWith("::") ? "" : (zoneless.split(":")[0] ?? "");
  if (firstGroup.length === 0) return "public";
  const value = Number.parseInt(firstGroup.padStart(4, "0").slice(0, 4), 16);
  if (Number.isNaN(value)) return "public";
  // fc00::/7 unique-local, fe80::/10 link-local.
  if ((value & 0xfe00) === 0xfc00) return "private";
  if ((value & 0xffc0) === 0xfe80) return "link-local";
  return "public";
}

/** Klasifikasi host apa adanya — tanpa DNS, tanpa I/O. */
export function classifyLocalHost(hostname: string): LocalHostReach {
  const host = hostname.toLowerCase();
  if (host.length === 0) return "public";

  if (host.startsWith("[") && host.endsWith("]")) return classifyIpv6(host.slice(1, -1));
  if (host.includes(":")) return classifyIpv6(host);

  const octets = parseIpv4(host);
  if (octets !== null) return classifyIpv4(octets);

  if (host === "localhost") return "loopback";
  for (const suffix of PRIVATE_NAME_SUFFIXES) {
    if (host.endsWith(suffix)) return "private-name";
  }
  // Nama satu label (`ollama`, `connect`) tidak bisa jadi DNS publik: itu nama layanan
  // container atau host LAN.
  if (!host.includes(".")) return "private-name";

  return "public";
}

export function isLocalReachableHost(hostname: string): boolean {
  return classifyLocalHost(hostname) !== "public";
}

/** Opt-out operator, dibaca saat validasi supaya bisa diubah tanpa rebuild. */
export function localBaseUrlPublicAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC === "1";
}
