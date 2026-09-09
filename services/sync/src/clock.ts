export function nowIso(): string {
  return new Date().toISOString();
}

export function isoAfterSeconds(now: string, seconds: number): string {
  return new Date(Date.parse(now) + seconds * 1000).toISOString();
}
