#!/usr/bin/env node

const CALLBACK_PATH = "/api/integrations/google-drive/callback";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const API_KEY_RE = /^[A-Za-z0-9_-]{16,512}$/u;
const APP_ID_RE = /^\d{6,32}$/u;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/u;

function fail(message) {
  console.error(`FAIL google-drive-local-preflight: ${message}`);
  process.exit(1);
}

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} belum diisi.`);
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function argValue(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) fail(`${name} membutuhkan nilai.`);
    return value;
  }
  return undefined;
}

function parseUrl(label, raw) {
  try {
    return new URL(raw);
  } catch {
    fail(`${label} bukan URL valid.`);
  }
}

function validateVaultKey(encoded) {
  if (encoded.includes("=") || !BASE64URL_RE.test(encoded)) {
    fail("ECORIONE_CONNECT_VAULT_MASTER_KEY harus base64url tanpa padding.");
  }
  const decoded = Buffer.from(encoded, "base64url");
  if (decoded.byteLength !== 32 || decoded.toString("base64url") !== encoded) {
    fail("ECORIONE_CONNECT_VAULT_MASTER_KEY harus tepat 32 byte base64url canonical.");
  }
}

function validateRedirect(redirect, expectedOrigin) {
  if (redirect.username || redirect.password || redirect.hash) {
    fail("Google Drive redirect URI tidak boleh berisi credential atau fragment.");
  }
  const localHttp = redirect.protocol === "http:" && LOCAL_HOSTS.has(redirect.hostname);
  const secure = redirect.protocol === "https:";
  if (!secure && !localHttp) {
    fail("Google Drive redirect URI harus HTTPS kecuali loopback localhost.");
  }
  if (redirect.pathname !== CALLBACK_PATH || redirect.search) {
    fail(`Google Drive redirect URI harus berakhir tepat di ${CALLBACK_PATH} tanpa query.`);
  }
  if (redirect.origin !== expectedOrigin.origin) {
    fail(
      `Redirect origin ${redirect.origin} tidak sama dengan Ai origin ${expectedOrigin.origin}.`,
    );
  }
}

const expectedOriginInput = argValue("--origin") ?? "http://localhost:3000";
const expectedOrigin = parseUrl("--origin", expectedOriginInput);
if (
  expectedOrigin.pathname !== "/" ||
  expectedOrigin.search ||
  expectedOrigin.hash ||
  expectedOrigin.username ||
  expectedOrigin.password
) {
  fail("--origin harus origin murni tanpa path, query, fragment, atau credential.");
}
const expectedLocalHttp =
  expectedOrigin.protocol === "http:" && LOCAL_HOSTS.has(expectedOrigin.hostname);
const expectedSecure = expectedOrigin.protocol === "https:";
if (!expectedSecure && !expectedLocalHttp) {
  fail("--origin harus HTTPS kecuali loopback localhost.");
}

const vaultKey = env("ECORIONE_CONNECT_VAULT_MASTER_KEY");
validateVaultKey(vaultKey);

const clientId = env("ECORIONE_GOOGLE_DRIVE_CLIENT_ID");
if (clientId.length < 10 || clientId.length > 4096) {
  fail("ECORIONE_GOOGLE_DRIVE_CLIENT_ID tidak memenuhi batas runtime.");
}

const clientSecret = optionalEnv("ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET");
if (clientSecret !== undefined && (clientSecret.length < 8 || clientSecret.length > 4096)) {
  fail("ECORIONE_GOOGLE_DRIVE_CLIENT_SECRET tidak memenuhi batas runtime.");
}

const redirect = parseUrl(
  "ECORIONE_GOOGLE_DRIVE_REDIRECT_URI",
  env("ECORIONE_GOOGLE_DRIVE_REDIRECT_URI"),
);
validateRedirect(redirect, expectedOrigin);

const pickerKey = env("ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY");
if (!API_KEY_RE.test(pickerKey)) {
  fail("ECORIONE_GOOGLE_DRIVE_PICKER_API_KEY tidak memenuhi batas runtime.");
}

const pickerAppId = env("ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID");
if (!APP_ID_RE.test(pickerAppId)) {
  fail("ECORIONE_GOOGLE_DRIVE_PICKER_APP_ID harus numeric Google Cloud project number.");
}

console.log("PASS google-drive-local-preflight");
console.log("vault_configured=1");
console.log("oauth_configured=1");
console.log(`oauth_client_secret=${clientSecret === undefined ? "absent" : "present"}`);
console.log("picker_configured=1");
console.log(`redirect_origin=${redirect.origin}`);
console.log(`redirect_path=${redirect.pathname}`);
