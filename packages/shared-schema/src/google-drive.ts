import { z } from "zod";
import { WorkspaceIdSchema } from "./ids.js";

export const GOOGLE_DRIVE_PROVIDER_ID = "google-drive" as const;
export const GOOGLE_DRIVE_FILE_SCOPE =
  "https://www.googleapis.com/auth/drive.file" as const;

export const GoogleDriveFileIdSchema = z.string().trim().min(1).max(1024);
export type GoogleDriveFileId = z.infer<typeof GoogleDriveFileIdSchema>;

export const GoogleDriveSelectedFileSchema = z
  .object({
    id: GoogleDriveFileIdSchema,
    name: z.string().trim().min(1).max(1024),
    mimeType: z.string().trim().min(1).max(255),
  })
  .strict();
export type GoogleDriveSelectedFile = z.infer<typeof GoogleDriveSelectedFileSchema>;

export const GoogleDrivePickerSelectionSchema = z
  .object({
    files: z.array(GoogleDriveSelectedFileSchema).min(1).max(20),
  })
  .strict();
export type GoogleDrivePickerSelection = z.infer<typeof GoogleDrivePickerSelectionSchema>;

export const GoogleDriveOAuthStartRequestSchema = z
  .object({
    workspaceId: WorkspaceIdSchema,
    returnPath: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^\/(?!\/)[^\r\n]*$/u, "returnPath harus relative path same-origin."),
  })
  .strict();
export type GoogleDriveOAuthStartRequest = z.infer<
  typeof GoogleDriveOAuthStartRequestSchema
>;

export const GoogleDriveOAuthStartResponseSchema = z
  .object({
    authorizationUrl: z.string().url(),
    expiresAt: z.string().datetime({ offset: false }),
  })
  .strict();
export type GoogleDriveOAuthStartResponse = z.infer<
  typeof GoogleDriveOAuthStartResponseSchema
>;

export const GoogleDriveConnectionStatusSchema = z
  .object({
    provider: z.literal(GOOGLE_DRIVE_PROVIDER_ID),
    connected: z.boolean(),
    scope: z.literal(GOOGLE_DRIVE_FILE_SCOPE),
    updatedAt: z.string().datetime({ offset: false }).nullable(),
  })
  .strict();
export type GoogleDriveConnectionStatus = z.infer<
  typeof GoogleDriveConnectionStatusSchema
>;
