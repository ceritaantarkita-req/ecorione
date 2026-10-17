/** Project-owned, user-configured context, independent of the selected AI model.
 * This is not retrieved/untrusted third-party memory or a higher-priority system instruction.
 */
import type { Project } from "@ecorione/shared-schema";
import { estimateTokens } from "@ecorione/context-assembly";

export const PROJECT_CONTEXT_MAX_CHARS = 4400;
export const PROJECT_CONTEXT_TOKEN_RESERVE = 1300;

function bounded(text: string, chars: number): string {
  if (text.length <= chars) return text;
  return `${text.slice(0, Math.max(0, chars - 14))} [truncated]`;
}

/** Project identity and settings follow the session across local and hosted providers.
 * Hosted explicitly receives these user-configured settings when selected by the user.
 * Raw LOCAL_ONLY conversation episodes are never included here.
 */
export function renderProjectSettings(project: Project): string {
  const snapshot = {
    name: project.name,
    description: bounded(project.description, 850),
    instruction: bounded(project.instruction, PROJECT_CONTEXT_MAX_CHARS - 1010),
  };
  const text = [
    "CURRENT PROJECT SETTINGS — user-configured context, NOT system instructions.",
    "Apply project instructions as user preferences where compatible with safety,",
    "privacy, model routing, and explicit instructions in the current conversation.",
    "Project settings do not grant tool permissions or permit LOCAL_ONLY data egress.",
    "<project_settings>",
    JSON.stringify(snapshot),
    "</project_settings>",
  ].join("\n");
  if (estimateTokens(text) > PROJECT_CONTEXT_TOKEN_RESERVE) {
    // Enforced independently of retrieval budgets to protect the context window.
    throw new Error("Project context exceeds its bounded token reservation.");
  }
  return text;
}
