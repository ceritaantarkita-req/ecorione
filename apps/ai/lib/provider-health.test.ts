import { describe, expect, it } from "vitest";
import { canaryStatusFromErrorCode, providerHealth } from "./provider-health";

describe("providerHealth", () => {
  it("distinguishes stored credentials from verified connectivity", () => {
    expect(
      providerHealth({
        hasCredential: true,
        routingReady: true,
        isCurrentHostedProvider: true,
        hostedCallsEnabled: true,
      }),
    ).toEqual({
      status: "stored",
      label: "Credential stored · run provider test to verify it.",
    });

    expect(
      providerHealth({
        hasCredential: true,
        routingReady: true,
        isCurrentHostedProvider: true,
        hostedCallsEnabled: true,
        canaryStatus: "connected",
      }).status,
    ).toBe("connected");
  });

  it("reports disabled before attempting provider health", () => {
    expect(
      providerHealth({
        hasCredential: true,
        routingReady: true,
        isCurrentHostedProvider: true,
        hostedCallsEnabled: false,
        canaryStatus: "connected",
      }).status,
    ).toBe("disabled");
  });

  it("keeps credential-only providers honest", () => {
    expect(
      providerHealth({
        hasCredential: true,
        routingReady: false,
        isCurrentHostedProvider: false,
        hostedCallsEnabled: true,
      }).status,
    ).toBe("routing-unavailable");
  });

  it("maps machine-readable canary errors without parsing messages", () => {
    expect(canaryStatusFromErrorCode("PROVIDER_INVALID_CREDENTIAL")).toBe("invalid-key");
    expect(canaryStatusFromErrorCode("PROVIDER_UNREACHABLE")).toBe("unreachable");
    expect(canaryStatusFromErrorCode("PROVIDER_UPSTREAM_ERROR")).toBe("error");
  });
});
