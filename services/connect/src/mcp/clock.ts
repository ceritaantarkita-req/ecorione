/** Real clock only at MCP I/O edge; reuse the audited Connect clock source. */
import { nowIso } from "../clock.js";

export function epochMs(): number {
  return Date.parse(nowIso());
}
