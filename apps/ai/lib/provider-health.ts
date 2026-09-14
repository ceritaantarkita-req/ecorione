export type ProviderHealthStatus =
  | "not-connected"
  | "routing-unavailable"
  | "stored"
  | "disabled"
  | "connected"
  | "invalid-key"
  | "unreachable"
  | "error";

export interface ProviderHealthInput {
  readonly hasCredential: boolean;
  readonly routingReady: boolean;
  readonly isCurrentHostedProvider: boolean;
  readonly hostedCallsEnabled: boolean;
  readonly canaryStatus?:
    | "connected"
    | "invalid-key"
    | "unreachable"
    | "error"
    | undefined;
}

export interface ProviderHealthView {
  readonly status: ProviderHealthStatus;
  readonly label: string;
}

export function canaryStatusFromErrorCode(code: string | undefined): ProviderHealthInput["canaryStatus"] {
  switch (code) {
    case "PROVIDER_INVALID_CREDENTIAL":
      return "invalid-key";
    case "PROVIDER_UNREACHABLE":
      return "unreachable";
    case "PROVIDER_CREDENTIAL_MISSING":
      return undefined;
    default:
      return "error";
  }
}

export function providerHealth(input: ProviderHealthInput): ProviderHealthView {
  if (!input.hasCredential) return { status: "not-connected", label: "Not connected." };
  if (!input.routingReady)
    return {
      status: "routing-unavailable",
      label: "Credential stored · model routing is not enabled yet.",
    };
  if (!input.isCurrentHostedProvider)
    return {
      status: "stored",
      label: "Credential stored · select this provider as Hosted provider to test it.",
    };
  if (!input.hostedCallsEnabled)
    return {
      status: "disabled",
      label: "Disabled · hosted calls are currently off.",
    };

  switch (input.canaryStatus) {
    case "connected":
      return { status: "connected", label: "Connected · provider canary passed." };
    case "invalid-key":
      return { status: "invalid-key", label: "Invalid key · provider rejected the credential." };
    case "unreachable":
      return { status: "unreachable", label: "Unreachable · provider could not be contacted." };
    case "error":
      return { status: "error", label: "Unavailable · provider test failed." };
    default:
      return { status: "stored", label: "Credential stored · run provider test to verify it." };
  }
}
