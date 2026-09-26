import type { SpaceBlockType, SpaceDocument } from "@ecorione/shared-schema";

export const BLOCK_KINDS: SpaceBlockType[] = [
  "paragraph",
  "heading",
  "list",
  "checklist",
  "table",
  "database-view",
  "file",
  "image",
  "embed",
  "ai",
  "context-link",
  "artifact-link",
  "flow-link",
];

export function templateFor(
  kind: SpaceBlockType,
  document: SpaceDocument | null,
): unknown | null {
  switch (kind) {
    case "paragraph":
      return { kind, text: "" };
    case "heading":
      return { kind, text: "Heading", level: 2 };
    case "list":
      return { kind, style: "bullet", items: ["Item"] };
    case "checklist":
      return { kind, items: [{ id: "item_first", text: "Task", checked: false }] };
    case "table":
      return {
        kind,
        columns: [{ id: "col_title", label: "Title" }],
        rows: [{ id: "row_first", cells: { col_title: "Value" } }],
      };
    case "database-view": {
      const table = document?.blocks.find((block) => block.type === "table");
      return table === undefined ? null : { kind, sourceBlockId: table.id };
    }
    case "file":
      return { kind, artifactId: `art_${"0".repeat(64)}`, label: "Replace artifact id" };
    case "image":
      return { kind, artifactId: `art_${"0".repeat(64)}`, alt: "" };
    case "embed":
      return { kind, url: "https://example.com", title: "Embed" };
    case "ai":
      return {
        kind,
        graphId: "fg_replace01",
        prompt: "Describe what this AI block should do.",
      };
    case "context-link":
      return { kind, factId: "mem_replace", label: "Context fact" };
    case "artifact-link":
      return { kind, artifactId: `art_${"0".repeat(64)}`, label: "Artifact" };
    case "flow-link":
      return { kind, graphId: "fg_replace01", label: "Flow" };
  }
}
