export class MultimodalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MultimodalError";
  }
}

export class MultimodalAdapterUnavailableError extends MultimodalError {
  constructor(message: string) {
    super(message);
    this.name = "MultimodalAdapterUnavailableError";
  }
}

export class UnsupportedHostedMultimodalProviderError extends MultimodalError {
  constructor(provider: string) {
    super(`Hosted multimodal belum didukung untuk provider ${provider}; tidak ada fallback provider diam-diam.`);
    this.name = "UnsupportedHostedMultimodalProviderError";
  }
}

export class MultimodalProviderError extends MultimodalError {
  constructor(message: string) {
    super(message);
    this.name = "MultimodalProviderError";
  }
}

export class MultimodalArtifactCommitUncertainError extends MultimodalError {
  constructor(message: string) {
    super(message);
    this.name = "MultimodalArtifactCommitUncertainError";
  }
}
