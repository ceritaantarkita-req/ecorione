import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..");

describe("PCS-09 staging hardening source contract", () => {
  it("captures sanitized host/runtime/security facts without reading secret values", () => {
    const source = readFileSync(resolve(ROOT, "scripts/staging-pcs09-inventory.mjs"), "utf8");
    expect(source).toContain("restartPolicy");
    expect(source).toContain("unless-stopped");
    expect(source).toContain("publishedPorts");
    expect(source).toContain("dockerEnabledAtBoot");
    expect(source).toContain("ufwActive");
    expect(source).toContain("passwordAuthentication");
    expect(source).toContain("permitRootLogin");
    expect(source).toContain("availableDiskGiB");
    expect(source).toContain("availableMemoryMiB");
    expect(source).toContain("connect-runtime-settings.json");
    expect(source).toContain("connect-credentials.vault.json");
    expect(source).toContain("No env values, credential plaintext");
    expect(source).not.toContain("cat deploy/staging.env");
    expect(source).not.toContain("docker system prune");
    expect(source).not.toContain("docker volume prune");
  });
});
