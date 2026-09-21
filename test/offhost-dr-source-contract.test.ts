import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

describe("off-host DR source contract", () => {
  it("creates an authenticated encrypted bundle from a verified PCS-09 backup", () => {
    const bundle = source("scripts/staging-offhost-dr-bundle.mjs");

    expect(bundle).toContain("aes-256-gcm");
    expect(bundle).toContain("rsa-oaep-sha256");
    expect(bundle).toContain("RSA_PKCS1_OAEP_PADDING");
    expect(bundle).toContain("modulusLength");
    expect(bundle).toContain("< 3072");
    expect(bundle).toContain("SHA256SUMS");
    expect(bundle).toContain("archive SHA-256 mismatch");
    expect(bundle).toContain("cipher.setAAD(aad)");
    expect(bundle).toContain("Private DR key is intentionally not used on the source host");
    expect(bundle).not.toContain("createPrivateKey");
    expect(bundle).not.toContain("privateDecrypt");
  });

  it("verifies encryption and can restore every archive into isolated Docker volumes", () => {
    const verify = source("scripts/staging-offhost-dr-verify.mjs");

    expect(verify).toContain("privateDecrypt");
    expect(verify).toContain("decipher.setAuthTag(tag)");
    expect(verify).toContain("Unsafe tar entry detected");
    expect(verify).toContain("--verify-docker");
    expect(verify).toContain("ecorione-dr-verify-");
    expect(verify).toContain("fingerprintVolume");
    expect(verify).toContain("Docker restore content mismatch");
    expect(verify).toContain('"volume", "rm", "-f"');
    expect(verify).not.toContain("docker volume prune");
    expect(verify).not.toContain("docker system prune");
  });

  it("copies only encrypted artifacts to an acknowledged independent SSH failure domain", () => {
    const transfer = source("scripts/staging-offhost-dr-transfer.sh");

    expect(transfer).toContain("ECORIONE_DR_FAILURE_DOMAIN_ACK");
    expect(transfer).toContain("StrictHostKeyChecking=yes");
    expect(transfer).toContain("IdentitiesOnly=yes");
    expect(transfer).toContain("ClearAllForwardings=yes");
    expect(transfer).toContain("sha256sum");
    expect(transfer).toContain(".part-$$");
    expect(transfer).toContain("Private DR decryption key is intentionally not transferred");
    expect(transfer).not.toContain("ssh-keyscan");
    expect(transfer).not.toContain("eval ");
  });
});
