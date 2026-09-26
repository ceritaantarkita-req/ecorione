import type {
  SpaceBlock,
  SpaceBlockType,
  SpaceDocument,
} from "@ecorione/shared-schema";
import styles from "./Space.module.css";

export function templateFor(kind: SpaceBlockType, document: SpaceDocument | null): unknown | null {
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

export function BlockPreview({ block }: { block: SpaceBlock }) {
  const body = block.body;
  switch (body.kind) {
    case "paragraph":
      return <p>{body.text || "Empty paragraph"}</p>;
    case "heading":
      return (
        <strong style={{ fontSize: body.level === 1 ? 28 : body.level === 2 ? 22 : 18 }}>
          {body.text}
        </strong>
      );
    case "list": {
      const Tag = body.style === "numbered" ? "ol" : "ul";
      return (
        <Tag>
          {body.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </Tag>
      );
    }
    case "checklist":
      return (
        <div>
          {body.items.map((item) => (
            <label key={item.id}>
              <input type="checkbox" checked={item.checked} readOnly /> {item.text}
            </label>
          ))}
        </div>
      );
    case "table":
      return (
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {body.columns.map((column) => (
                  <th key={column.id}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.rows.slice(0, 8).map((row) => (
                <tr key={row.id}>
                  {body.columns.map((column) => (
                    <td key={column.id}>{row.cells[column.id] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "database-view":
      return <span>Database view → {body.sourceBlockId}</span>;
    case "file":
      return (
        <span>
          File pointer → {body.artifactId}
          {body.label ? ` · ${body.label}` : ""}
        </span>
      );
    case "image":
      return (
        <span>
          Image pointer → {body.artifactId}
          {body.caption ? ` · ${body.caption}` : ""}
        </span>
      );
    case "embed":
      return (
        <a href={body.url} target="_blank" rel="noreferrer">
          {body.title ?? body.url}
        </a>
      );
    case "ai":
      return (
        <div>
          <strong>AI via Flow {body.graphId}</strong>
          <p>{body.prompt}</p>
        </div>
      );
    case "context-link":
      return (
        <span>
          Context fact → {body.factId}
          {body.label ? ` · ${body.label}` : ""}
        </span>
      );
    case "artifact-link":
      return (
        <span>
          Artifact → {body.artifactId}
          {body.label ? ` · ${body.label}` : ""}
        </span>
      );
    case "flow-link":
      return (
        <span>
          Flow → {body.graphId}
          {body.label ? ` · ${body.label}` : ""}
        </span>
      );
  }
}
