import { describe, expect, it } from "vitest";
import {
  classifyLocalHost,
  isLocalReachableHost,
  localBaseUrlPublicAllowed,
} from "./local-base-url.js";

describe("classifyLocalHost", () => {
  it("mengenali loopback IPv4 dan IPv6", () => {
    expect(classifyLocalHost("127.0.0.1")).toBe("loopback");
    expect(classifyLocalHost("127.255.255.254")).toBe("loopback");
    expect(classifyLocalHost("0.0.0.0")).toBe("loopback");
    expect(classifyLocalHost("[::1]")).toBe("loopback");
    expect(classifyLocalHost("localhost")).toBe("loopback");
  });

  it("mengenali seluruh blok RFC1918 dan CGNAT", () => {
    for (const host of [
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.10",
      "100.72.1.5",
    ]) {
      expect(classifyLocalHost(host)).toBe("private");
    }
  });

  it("tidak salah mengira tetangga blok privat sebagai privat", () => {
    for (const host of ["172.15.0.1", "172.32.0.1", "192.169.1.1", "11.0.0.1", "100.63.0.1"]) {
      expect(classifyLocalHost(host)).toBe("public");
    }
  });

  it("mengenali link-local", () => {
    expect(classifyLocalHost("169.254.1.1")).toBe("link-local");
    expect(classifyLocalHost("[fe80::1]")).toBe("link-local");
  });

  it("mengenali unique-local IPv6 dan IPv4-mapped", () => {
    expect(classifyLocalHost("[fd00::1]")).toBe("private");
    expect(classifyLocalHost("fd00::1")).toBe("private");
    expect(classifyLocalHost("[fc00::1]")).toBe("private");
    expect(classifyLocalHost("2606:4700::1111")).toBe("public");
    expect(classifyLocalHost("[::ffff:192.168.0.5]")).toBe("private");
    expect(classifyLocalHost("[::ffff:8.8.8.8]")).toBe("public");
    expect(classifyLocalHost("[2606:4700::1111]")).toBe("public");
  });

  it("mempercayai nama host yang tidak bisa jadi DNS publik", () => {
    // Default installer desktop memakai host.docker.internal.
    expect(classifyLocalHost("host.docker.internal")).toBe("private-name");
    expect(classifyLocalHost("gateway.docker.internal")).toBe("private-name");
    expect(classifyLocalHost("nas.local")).toBe("private-name");
    expect(classifyLocalHost("ollama")).toBe("private-name");
    expect(classifyLocalHost("app.localhost")).toBe("private-name");
  });

  it("menolak host publik — termasuk serangan yang dibuktikan di audit", () => {
    expect(classifyLocalHost("evil.example")).toBe("public");
    expect(classifyLocalHost("api.openai.com")).toBe("public");
    expect(classifyLocalHost("8.8.8.8")).toBe("public");
    expect(isLocalReachableHost("evil.example")).toBe(false);
  });

  it("tidak tertipu huruf besar", () => {
    expect(classifyLocalHost("LOCALHOST")).toBe("loopback");
    expect(classifyLocalHost("HOST.DOCKER.INTERNAL")).toBe("private-name");
  });

  it("menolak host kosong", () => {
    expect(classifyLocalHost("")).toBe("public");
  });
});

describe("localBaseUrlPublicAllowed", () => {
  it("hanya `1` yang membuka opt-out", () => {
    expect(localBaseUrlPublicAllowed({})).toBe(false);
    expect(localBaseUrlPublicAllowed({ ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC: "0" })).toBe(
      false,
    );
    expect(localBaseUrlPublicAllowed({ ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC: "true" })).toBe(
      false,
    );
    expect(localBaseUrlPublicAllowed({ ECORIONE_LOCAL_BASE_URL_ALLOW_PUBLIC: "1" })).toBe(true);
  });
});
