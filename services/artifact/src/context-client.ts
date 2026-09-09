/** Context metadata client. Artifact never opens Context's SQLite file. */
import { ArtifactPointerSchema, type ArtifactPointer, type Scope, type Sensitivity, type SyncClass } from "@ecorione/shared-schema";
import { httpJson } from "@ecorione/shared-server";

export interface ArtifactMetadataClient {
  register(pointer: ArtifactPointer): Promise<ArtifactPointer>;
  authorize(input: {
    id: ArtifactPointer["id"];
    scope: Scope;
    maxSensitivity: Sensitivity;
    hostedEligible: boolean;
  }): Promise<ArtifactPointer>;
}

export function createContextMetadataClient(baseUrl: string, token?: string): ArtifactMetadataClient {
  return {
    async register(pointer) {
      const result = await httpJson<unknown>(`${baseUrl}/v1/artifacts`, { token, body: pointer });
      return ArtifactPointerSchema.parse(result);
    },
    async authorize(input) {
      const query = new URLSearchParams({
        scope: input.scope,
        maxSensitivity: input.maxSensitivity,
        hostedEligible: input.hostedEligible ? "1" : "0",
      });
      const result = await httpJson<unknown>(
        `${baseUrl}/v1/artifacts/${encodeURIComponent(input.id)}/authorize?${query.toString()}`,
        { token },
      );
      return ArtifactPointerSchema.parse(result);
    },
  };
}

export function normalizedSyncClass(value: SyncClass | undefined): SyncClass {
  return value ?? "LOCAL_ONLY";
}
