import {
  MultimodalAdapterResultSchema,
  maySendToHosted,
  type MultimodalAdapterResult,
  type MultimodalInferRequest,
  type Timestamp,
} from "@ecorione/shared-schema";
import { z } from "zod";
import type { HostedProviderId } from "./provider-types.js";
import { CostKillSwitchError, MissingCredentialError, ProviderError } from "./providers/errors.js";
import type { FileSpendBudget, SpendEntry } from "./spend-budget.js";

type SpendBudgetController = Pick<FileSpendBudget, "reserve" | "settle" | "markUncertain">;
const AdapterOutputSchema = MultimodalAdapterResultSchema.omit({ routeUsed: true });
type AdapterOutput = z.infer<typeof AdapterOutputSchema>;

export interface MultimodalAdapter {
  readonly route: "local" | "hosted";
  estimateReservationUsd(input: MultimodalInferRequest): number;
  infer(input: MultimodalInferRequest): Promise<AdapterOutput>;
}

export interface HttpMultimodalAdapterOptions {
  readonly route: "local" | "hosted";
  readonly endpoint: string;
  readonly reservationUsd?: number | undefined;
  readonly authorizationBearer?: (() => string | undefined) | undefined;
}

export class HttpMultimodalAdapter implements MultimodalAdapter {
  readonly route: "local" | "hosted";
  private readonly endpoint: string;
  private readonly reservationUsd: number;
  private readonly authorizationBearer: (() => string | undefined) | undefined;

  constructor(options: HttpMultimodalAdapterOptions) {
    this.route = options.route;
    this.endpoint = options.endpoint;
    this.reservationUsd = options.reservationUsd ?? (this.route === "hosted" ? 1 : 0);
    const validReservation =
      Number.isFinite(this.reservationUsd) &&
      (this.route === "hosted" ? this.reservationUsd > 0 : this.reservationUsd === 0);
    if (!validReservation) {
      throw new Error(
        this.route === "hosted"
          ? "Multimodal hosted reservationUsd harus angka positif."
          : "Multimodal local reservationUsd harus 0.",
      );
    }
    if (this.route === "hosted" && options.authorizationBearer === undefined) {
      throw new Error("Adapter multimodal hosted wajib memakai credential reader milik Connect.");
    }
    this.authorizationBearer = options.authorizationBearer;
  }

  estimateReservationUsd(): number {
    return this.reservationUsd;
  }

  async infer(input: MultimodalInferRequest): Promise<AdapterOutput> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const bearer = this.authorizationBearer?.();
    if (this.route === "hosted" && (bearer === undefined || bearer === "")) {
      throw new MissingCredentialError("Connect multimodal hosted adapter");
    }
    if (bearer !== undefined) headers.authorization = `Bearer ${bearer}`;
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
      });
    } catch (error) {
      throw new ProviderError(
        this.route,
        `Adapter multimodal tidak bisa dihubungi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 512);
      throw new ProviderError(
        this.route,
        `Adapter multimodal HTTP ${String(response.status)}${detail === "" ? "" : `: ${detail}`}`,
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderError(this.route, "Adapter multimodal mengembalikan JSON tidak valid.");
    }
    const parsed = AdapterOutputSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ProviderError(this.route, "Adapter multimodal mengembalikan kontrak yang tidak valid.");
    }
    if (/latest/i.test(parsed.data.model)) {
      throw new ProviderError(this.route, "Adapter multimodal mengembalikan model alias latest yang dilarang.");
    }
    return parsed.data;
  }
}

export interface MultimodalDeps {
  readonly localAdapter?: MultimodalAdapter | undefined;
  readonly hostedAdapter?: MultimodalAdapter | undefined;
  readonly hostedProvider: HostedProviderId;
  readonly hostedCallsEnabled: boolean;
  readonly spendBudget?: SpendBudgetController | undefined;
}

function requireAdapter(
  deps: MultimodalDeps,
  route: "local" | "hosted",
): MultimodalAdapter {
  const adapter = route === "local" ? deps.localAdapter : deps.hostedAdapter;
  if (adapter === undefined) {
    throw new ProviderError(route, `Adapter multimodal ${route} belum dikonfigurasi.`);
  }
  return adapter;
}

async function callRoute(
  deps: MultimodalDeps,
  input: MultimodalInferRequest,
  route: "local" | "hosted",
  now: Timestamp,
): Promise<MultimodalAdapterResult> {
  if (route === "hosted") {
    if (!maySendToHosted(input.syncClass)) {
      throw new ProviderError("hosted", `syncClass ${input.syncClass} tidak boleh dikirim ke hosted.`);
    }
    if (!deps.hostedCallsEnabled) throw new CostKillSwitchError();
  }
  const adapter = requireAdapter(deps, route);
  let reservation: SpendEntry | undefined;
  if (route === "hosted" && deps.spendBudget !== undefined) {
    reservation = deps.spendBudget.reserve({
      operationId: input.operationId,
      provider: deps.hostedProvider,
      model: "multimodal-adapter-v1",
      reservedUsd: adapter.estimateReservationUsd(input),
      now,
    });
  }
  try {
    const output = await adapter.infer(input);
    if (route === "local" && (output.actualUsd !== 0 || output.naiveUsd !== 0)) {
      throw new ProviderError("local", "Adapter local tidak boleh melaporkan biaya hosted.");
    }
    if (reservation !== undefined && deps.spendBudget !== undefined) {
      try {
        deps.spendBudget.settle(reservation.reservationId, output.actualUsd, now);
      } catch {
        // Provider success is final. Durable reservation remains conservative if local settlement fails.
      }
    }
    return MultimodalAdapterResultSchema.parse({ ...output, routeUsed: route });
  } catch (error) {
    if (reservation !== undefined && deps.spendBudget !== undefined) {
      try {
        deps.spendBudget.markUncertain(reservation.reservationId);
      } catch {
        // Reservation is already durable; retain it rather than hiding the original provider failure.
      }
    }
    throw error;
  }
}

export async function inferMultimodal(
  deps: MultimodalDeps,
  input: MultimodalInferRequest,
  now: Timestamp,
): Promise<MultimodalAdapterResult> {
  if (input.route.preferred === "hosted") return callRoute(deps, input, "hosted", now);
  try {
    return await callRoute(deps, input, "local", now);
  } catch (localError) {
    if (!input.route.allowHostedFallback) throw localError;
    return callRoute(deps, input, "hosted", now);
  }
}
