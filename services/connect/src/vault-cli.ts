import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CREDENTIAL_PROVIDERS,
  CREDENTIAL_PURPOSES,
  FileCredentialVault,
  type CredentialProvider,
  type CredentialPurpose,
} from "./credential-vault.js";
import { nowIso } from "./clock.js";

function defaultVaultPath(): string {
  return resolve(import.meta.dirname, "../../../data/connect-credentials.vault.json");
}

function requireProvider(value: string | undefined): CredentialProvider {
  if (value !== undefined && CREDENTIAL_PROVIDERS.some((candidate) => candidate === value)) {
    return value as CredentialProvider;
  }
  throw new Error(`Provider wajib salah satu: ${CREDENTIAL_PROVIDERS.join(", ")}.`);
}

function requirePurpose(value: string | undefined): CredentialPurpose {
  if (value !== undefined && CREDENTIAL_PURPOSES.some((candidate) => candidate === value)) {
    return value as CredentialPurpose;
  }
  throw new Error(`Purpose wajib salah satu: ${CREDENTIAL_PURPOSES.join(", ")}.`);
}

function readStdinSecret(): string {
  return readFileSync(0, "utf8").replace(/\r?\n$/, "");
}

function configuredVault(): FileCredentialVault {
  const masterKey = process.env.ECORIONE_CONNECT_VAULT_MASTER_KEY;
  if (masterKey === undefined || masterKey.length === 0) {
    throw new Error("ECORIONE_CONNECT_VAULT_MASTER_KEY wajib diisi untuk operasi vault.");
  }
  return new FileCredentialVault(
    process.env.ECORIONE_CONNECT_VAULT_PATH ?? defaultVaultPath(),
    masterKey,
  );
}

async function main(): Promise<void> {
  const [command, providerArg, purposeArg] = process.argv.slice(2);
  if (command === "keygen") {
    process.stdout.write(`${randomBytes(32).toString("base64url")}\n`);
    return;
  }
  if (command === "list") {
    process.stdout.write(`${JSON.stringify(configuredVault().list(), null, 2)}\n`);
    return;
  }
  if (command === "set") {
    const provider = requireProvider(providerArg);
    const purpose = requirePurpose(purposeArg);
    const secret = readStdinSecret();
    const metadata = configuredVault().set(provider, purpose, secret, nowIso());
    process.stdout.write(`${JSON.stringify(metadata)}\n`);
    return;
  }
  if (command === "rotate-master") {
    const nextMasterKey = readStdinSecret();
    configuredVault().rotateMasterKey(nextMasterKey);
    process.stdout.write(
      "Master key rotated. Update ECORIONE_CONNECT_VAULT_MASTER_KEY before starting Connect.\n",
    );
    return;
  }
  throw new Error("Command: keygen | list | set <provider> <purpose> | rotate-master");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
