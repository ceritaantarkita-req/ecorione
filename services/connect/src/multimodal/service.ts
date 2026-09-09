import {
  ArtifactPointerSchema,
  ConnectMultimodalProcessResponseSchema,
  ConnectSpeechResponseSchema,
  type ConnectMultimodalProcessRequest,
  type ConnectMultimodalProcessResponse,
  type ConnectSpeechRequest,
  type ConnectSpeechResponse,
  type Timestamp,
} from "@ecorione/shared-schema";
import { z } from "zod";
import type { ProviderCredentialReader } from "../credential-vault.js";
import {
  DEFAULT_HOSTED_PROVIDER,
  providerCredentialLabel,
  type HostedProviderId,
} from "../provider-types.js";
import { CostKillSwitchError, MissingCredentialError } from "../providers/errors.js";
import type { FileSpendBudget, SpendEntry } from "../spend-budget.js";
import {
  MultimodalAdapterUnavailableError,
  MultimodalArtifactCommitUncertainError,
  MultimodalProviderError,
  UnsupportedHostedMultimodalProviderError,
} from "./errors.js";
import { HttpLocalMultimodalAdapter } from "./local.js";
import { OpenAiMultimodalAdapter } from "./openai.js";
import type { MultimodalAdapter } from "./types.js";

type SpendBudgetController = Pick<FileSpendBudget, "reserve" | "markUncertain">;

const UploadResponseSchema = z.object({
  pointer: ArtifactPointerSchema,
  deduplicated: z.boolean(),
});

function filenameFor(pointer: ConnectMultimodalProcessRequest["artifact"]): string {
  const mime = pointer.mimeType.toLowerCase();
  const ext =
    mime === "application/pdf"
      ? "pdf"
      : mime.startsWith("image/")
        ? mime.slice("image/".length).replace("jpeg", "jpg")
        : mime.startsWith("audio/")
          ? mime.slice("audio/".length).replace("mpeg", "mp3")
          : mime.startsWith("video/")
            ? mime.slice("video/".length)
            : "bin";
  return `${pointer.id}.${ext}`;
}

function developmentKey(
  provider: HostedProviderId,
  keys: {
    anthropicApiKey?: string | undefined;
    openrouterApiKey?: string | undefined;
    openaiApiKey?: string | undefined;
  },
): string | undefined {
  switch (provider) {
    case "anthropic":
      return keys.anthropicApiKey;
    case "openrouter":
      return keys.openrouterApiKey;
    case "openai":
      return keys.openaiApiKey;
  }
}

export interface MultimodalServiceOptions {
  readonly artifactUrl: string;
  readonly internalToken?: string | undefined;
  readonly localBaseUrl: string;
  readonly localAdapter?: MultimodalAdapter | undefined;
  readonly hostedProvider?: HostedProviderId | undefined;
  readonly credentialVault?: ProviderCredentialReader | undefined;
  readonly anthropicApiKey?: string | undefined;
  readonly openrouterApiKey?: string | undefined;
  readonly openaiApiKey?: string | undefined;
  readonly hostedCallsEnabled?: boolean | undefined;
  readonly spendBudget?: SpendBudgetController | undefined;
  /** Conservative reservation; retained as uncertain because audio/image billing is not normalized here. */
  readonly hostedReservationUsd?: number | undefined;
  readonly openaiVisionModel?: string | undefined;
  readonly openaiTranscriptionModel?: string | undefined;
  readonly openaiTtsModel?: string | undefined;
  readonly openaiBaseUrl?: string | undefined;
}

export class MultimodalService {
  private readonly local: MultimodalAdapter;
  private readonly hostedProvider: HostedProviderId;
  private readonly hostedReservationUsd: number;

  constructor(private readonly options: MultimodalServiceOptions) {
    this.local = options.localAdapter ?? new HttpLocalMultimodalAdapter(options.localBaseUrl);
    this.hostedProvider = options.hostedProvider ?? DEFAULT_HOSTED_PROVIDER;
    this.hostedReservationUsd = options.hostedReservationUsd ?? 1;
    if (!Number.isFinite(this.hostedReservationUsd) || this.hostedReservationUsd <= 0) {
      throw new MultimodalAdapterUnavailableError(
        "ECORIONE_MULTIMODAL_HOSTED_RESERVATION_USD harus angka positif.",
      );
    }
  }

  private hostedAdapter(): MultimodalAdapter {
    if (this.hostedProvider !== "openai") {
      throw new UnsupportedHostedMultimodalProviderError(this.hostedProvider);
    }
    if (this.options.hostedCallsEnabled === false) throw new CostKillSwitchError();
    const apiKey =
      this.options.credentialVault === undefined
        ? developmentKey(this.hostedProvider, this.options)
        : this.options.credentialVault.get(this.hostedProvider, "messages");
    if (apiKey === undefined) {
      const label = providerCredentialLabel(this.hostedProvider);
      throw new MissingCredentialError(
        this.options.credentialVault === undefined
          ? `${label} (dev fallback)`
          : `Connect vault ${this.hostedProvider}/messages`,
      );
    }
    return new OpenAiMultimodalAdapter({
      apiKey,
      visionModel: this.options.openaiVisionModel,
      transcriptionModel: this.options.openaiTranscriptionModel,
      ttsModel: this.options.openaiTtsModel,
      baseUrl: this.options.openaiBaseUrl,
    });
  }

  private reserveHosted(
    operationId: ConnectMultimodalProcessRequest["operationId"],
    model: string,
    now: Timestamp,
  ): SpendEntry | undefined {
    return this.options.spendBudget?.reserve({
      operationId,
      provider: this.hostedProvider,
      model,
      reservedUsd: this.hostedReservationUsd,
      now,
    });
  }

  private retainReservation(entry: SpendEntry | undefined): void {
    if (entry === undefined || this.options.spendBudget === undefined) return;
    try {
      this.options.spendBudget.markUncertain(entry.reservationId);
    } catch {
      // Reservation itself is already durable. Keep the provider result/error primary.
    }
  }

  private async artifactBytes(input: ConnectMultimodalProcessRequest): Promise<Buffer> {
    const hostedEligible = input.target === "hosted" ? "1" : "0";
    const url = new URL(
      `/v1/artifacts/${encodeURIComponent(input.artifact.id)}/content`,
      this.options.artifactUrl,
    );
    url.searchParams.set("scope", input.scope);
    url.searchParams.set("maxSensitivity", input.sensitivity);
    url.searchParams.set("hostedEligible", hostedEligible);
    const headers: Record<string, string> = {};
    if (this.options.internalToken !== undefined) {
      headers.authorization = `Bearer ${this.options.internalToken}`;
    }
    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch (error) {
      throw new MultimodalAdapterUnavailableError(
        `Artifact tidak tersedia: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      const body = await response.text();
      throw new MultimodalProviderError(
        `Artifact menolak media (${String(response.status)}): ${body.slice(0, 512)}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async process(input: ConnectMultimodalProcessRequest): Promise<ConnectMultimodalProcessResponse> {
    const bytes = await this.artifactBytes(input);
    const adapter = input.target === "local" ? this.local : this.hostedAdapter();
    const reservation =
      input.target === "hosted"
        ? this.reserveHosted(
            input.operationId,
            input.task === "transcribe"
              ? this.options.openaiTranscriptionModel ?? "whisper-1"
              : this.options.openaiVisionModel ?? "gpt-5.6-terra",
            input.now,
          )
        : undefined;
    try {
      const output = await adapter.process({
        bytes,
        mimeType: input.artifact.mimeType,
        filename: filenameFor(input.artifact),
        task: input.task,
      });
      this.retainReservation(reservation);
      return ConnectMultimodalProcessResponseSchema.parse({
        result: output.result,
        target: input.target,
        provider: output.provider,
        model: output.model,
        spendReservationId: reservation?.reservationId ?? null,
        reservedUsd: reservation?.reservedUsd ?? null,
        spendStatus: reservation === undefined ? "none" : "uncertain",
      });
    } catch (error) {
      this.retainReservation(reservation);
      throw error;
    }
  }

  private async commitSpeechArtifact(
    input: ConnectSpeechRequest,
    output: Awaited<ReturnType<MultimodalAdapter["speech"]>>,
  ): Promise<ConnectSpeechResponse["artifact"]> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.options.internalToken !== undefined) {
      headers.authorization = `Bearer ${this.options.internalToken}`;
    }
    let response: Response;
    try {
      response = await fetch(new URL("/v1/artifacts", this.options.artifactUrl), {
        method: "POST",
        headers,
        body: JSON.stringify({
          contentBase64: output.bytes.toString("base64"),
          mimeType: output.mimeType,
          description: `TTS ${output.model}`,
          scope: input.scope,
          sensitivity: input.sensitivity,
          syncClass: input.syncClass,
        }),
      });
    } catch (error) {
      throw new MultimodalArtifactCommitUncertainError(
        `Speech selesai tetapi Artifact tidak dapat dihubungi: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const raw = await response.text();
    if (!response.ok) {
      throw new MultimodalArtifactCommitUncertainError(
        `Speech selesai tetapi Artifact membalas ${String(response.status)}: ${raw.slice(0, 512)}`,
      );
    }
    try {
      return UploadResponseSchema.parse(JSON.parse(raw) as unknown).pointer;
    } catch {
      throw new MultimodalArtifactCommitUncertainError(
        "Speech selesai tetapi respons commit Artifact tidak valid.",
      );
    }
  }

  async speech(input: ConnectSpeechRequest): Promise<ConnectSpeechResponse> {
    const adapter = input.target === "local" ? this.local : this.hostedAdapter();
    const reservation =
      input.target === "hosted"
        ? this.reserveHosted(
            input.operationId,
            this.options.openaiTtsModel ?? "gpt-4o-mini-tts",
            input.now,
          )
        : undefined;
    try {
      const output = await adapter.speech({
        text: input.text,
        language: input.language,
        voice: input.voice,
        format: input.format,
      });
      this.retainReservation(reservation);
      const artifact = await this.commitSpeechArtifact(input, output);
      return ConnectSpeechResponseSchema.parse({
        artifact,
        target: input.target,
        provider: output.provider,
        model: output.model,
        spendReservationId: reservation?.reservationId ?? null,
        reservedUsd: reservation?.reservedUsd ?? null,
        spendStatus: reservation === undefined ? "none" : "uncertain",
      });
    } catch (error) {
      this.retainReservation(reservation);
      throw error;
    }
  }
}
