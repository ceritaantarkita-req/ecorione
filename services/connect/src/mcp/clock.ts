/** Real clock only at MCP I/O edge; callers pass the captured value inward. */
export function epochMs(): number {
  return Date.now();
}
