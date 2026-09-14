export interface CredentialTestStamp {
  readonly provider: string;
  readonly revision: number;
  readonly pass: boolean;
}

export interface CredentialSaveReadyInput {
  readonly secret: string;
  readonly provider: string;
  readonly revision: number;
  readonly connectionTestReady: boolean;
  readonly test: CredentialTestStamp | null;
}

export function credentialSaveReady(input: CredentialSaveReadyInput): boolean {
  if (input.secret.length === 0) return false;
  if (!input.connectionTestReady) return true;
  return (
    input.test?.pass === true &&
    input.test.provider === input.provider &&
    input.test.revision === input.revision
  );
}
