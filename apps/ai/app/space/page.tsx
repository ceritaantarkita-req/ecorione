"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CoreMemory,
  SpaceBlock,
  SpaceBlockReferenceResolution,
  SpaceBlockType,
  SpaceDocument,
  SpacePage,
} from "@ecorione/shared-schema";

const WORKSPACE_ID = "ws_personal";
const BLOCK_KINDS: SpaceBlockType[] = [
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

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text.length === 0 ? null : (JSON.parse(text) as unknown);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}: ${JSON.stringify(body)}`);
  return body as T;
}

function templateFor(kind: SpaceBlockType, document: SpaceDocument | null): unknown | null {
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

function blockPreview(block: SpaceBlock) {
  const body = block.body;
  switch (body.kind) {
    case "paragraph":
      return (
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{body.text || "Empty paragraph"}</p>
      );
    case "heading":
      return (
        <strong style={{ fontSize: body.level === 1 ? 28 : body.level === 2 ? 22 : 18 }}>
          {body.text}
        </strong>
      );
    case "list": {
      const Tag = body.style === "numbered" ? "ol" : "ul";
      return (
        <Tag style={{ margin: 0 }}>
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
            <label key={item.id} style={{ display: "block" }}>
              <input type="checkbox" checked={item.checked} readOnly /> {item.text}
            </label>
          ))}
        </div>
      );
    case "table":
      return (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {body.columns.map((column) => (
                  <th
                    key={column.id}
                    style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 6 }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.rows.slice(0, 8).map((row) => (
                <tr key={row.id}>
                  {body.columns.map((column) => (
                    <td key={column.id} style={{ borderBottom: "1px solid #eee", padding: 6 }}>
                      {row.cells[column.id] ?? ""}
                    </td>
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
          <p style={{ marginBottom: 0 }}>{body.prompt}</p>
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

export default function SpacePageView() {
  const [pages, setPages] = useState<SpacePage[]>([]);
  const [document, setDocument] = useState<SpaceDocument | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [draftKind, setDraftKind] = useState<SpaceBlockType>("paragraph");
  const [draftJson, setDraftJson] = useState(
    JSON.stringify(templateFor("paragraph", null), null, 2),
  );
  const [inspectorJson, setInspectorJson] = useState("");
  const [resolution, setResolution] = useState<SpaceBlockReferenceResolution | null>(null);
  const [memory, setMemory] = useState<CoreMemory>({ blocks: [] });
  const [memoryLabel, setMemoryLabel] = useState("preferences");
  const [memoryDescription, setMemoryDescription] = useState("Preferensi pengguna");
  const [memoryValue, setMemoryValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedBlock = useMemo(
    () => document?.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [document, selectedBlockId],
  );

  const loadPage = useCallback(async (id: string) => {
    try {
      const next = await readJson<SpaceDocument>(
        await fetch(`/api/space/pages/${encodeURIComponent(id)}?workspaceId=${WORKSPACE_ID}`, {
          cache: "no-store",
        }),
      );
      setDocument(next);
      setSelectedPageId(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshPages = useCallback(async () => {
    try {
      const response = await fetch(`/api/space/pages?workspaceId=${WORKSPACE_ID}`, {
        cache: "no-store",
      });
      const next = (await readJson<{ pages: SpacePage[] }>(response)).pages;
      setPages(next);
      setSelectedPageId((current) => current ?? next[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshMemory = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/space/core-memory?scope=personal&maxSensitivity=RESTRICTED",
        { cache: "no-store" },
      );
      setMemory(await readJson<CoreMemory>(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refreshPages();
    void refreshMemory();
  }, [refreshPages, refreshMemory]);

  useEffect(() => {
    if (selectedPageId !== null) void loadPage(selectedPageId);
  }, [loadPage, selectedPageId]);

  useEffect(() => {
    if (selectedBlock === null) {
      setInspectorJson("");
      setResolution(null);
    } else {
      setInspectorJson(JSON.stringify(selectedBlock.body, null, 2));
      setResolution(null);
    }
  }, [selectedBlock]);

  async function createPage(event: React.FormEvent) {
    event.preventDefault();
    if (newPageTitle.trim().length === 0) return;
    try {
      const page = await readJson<SpacePage>(
        await fetch("/api/space/pages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
            title: newPageTitle.trim(),
            scope: "personal",
          }),
        }),
      );
      setNewPageTitle("");
      await refreshPages();
      setSelectedPageId(page.id);
      setNotice("Page dibuat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function chooseKind(kind: SpaceBlockType) {
    setDraftKind(kind);
    const template = templateFor(kind, document);
    if (template === null) {
      setError("Buat table block dulu sebelum database-view.");
      return;
    }
    setDraftJson(JSON.stringify(template, null, 2));
    setError(null);
  }

  async function addBlock() {
    if (document === null) return;
    try {
      const body = JSON.parse(draftJson) as unknown;
      const result = await readJson<{ block: SpaceBlock; pageVersion: number }>(
        await fetch(`/api/space/pages/${document.page.id}/blocks?workspaceId=${WORKSPACE_ID}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            body,
            position: document.blocks.length,
            expectedPageVersion: document.page.version,
          }),
        }),
      );
      await loadPage(document.page.id);
      await refreshPages();
      setSelectedBlockId(result.block.id);
      setNotice(`${draftKind} block ditambahkan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveBlock() {
    if (document === null || selectedBlock === null) return;
    try {
      const body = JSON.parse(inspectorJson) as unknown;
      await readJson(
        await fetch(`/api/space/blocks/${selectedBlock.id}?workspaceId=${WORKSPACE_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            body,
            expectedVersion: selectedBlock.version,
            expectedPageVersion: document.page.version,
          }),
        }),
      );
      await loadPage(document.page.id);
      await refreshPages();
      setNotice("Block disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteBlock(block: SpaceBlock) {
    if (document === null) return;
    try {
      await readJson(
        await fetch(
          `/api/space/blocks/${block.id}?workspaceId=${WORKSPACE_ID}&expectedVersion=${String(block.version)}&expectedPageVersion=${String(document.page.version)}`,
          { method: "DELETE" },
        ),
      );
      setSelectedBlockId(null);
      await loadPage(document.page.id);
      await refreshPages();
      setNotice("Block dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function moveBlock(block: SpaceBlock, delta: -1 | 1) {
    if (document === null) return;
    const index = document.blocks.findIndex((item) => item.id === block.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= document.blocks.length) return;
    const blockIds = document.blocks.map((item) => item.id);
    [blockIds[index], blockIds[target]] = [blockIds[target]!, blockIds[index]!];
    try {
      await readJson(
        await fetch(
          `/api/space/pages/${document.page.id}/reorder?workspaceId=${WORKSPACE_ID}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ blockIds, expectedPageVersion: document.page.version }),
          },
        ),
      );
      await loadPage(document.page.id);
      await refreshPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function resolveBlock() {
    if (selectedBlock === null) return;
    try {
      const value = await readJson<SpaceBlockReferenceResolution>(
        await fetch(
          `/api/space/blocks/${selectedBlock.id}/resolve?workspaceId=${WORKSPACE_ID}&maxSensitivity=RESTRICTED`,
          { cache: "no-store" },
        ),
      );
      setResolution(value);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function renamePage() {
    if (document === null) return;
    const title = globalThis.prompt("Judul page", document.page.title)?.trim();
    if (!title) return;
    try {
      await readJson(
        await fetch(`/api/space/pages/${document.page.id}?workspaceId=${WORKSPACE_ID}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title, expectedVersion: document.page.version }),
        }),
      );
      await loadPage(document.page.id);
      await refreshPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveMemory(event: React.FormEvent) {
    event.preventDefault();
    try {
      await readJson(
        await fetch(`/api/space/core-memory/${encodeURIComponent(memoryLabel)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description: memoryDescription,
            value: memoryValue,
            scope: "personal",
            sensitivity: "INTERNAL",
            syncClass: "LOCAL_ONLY",
          }),
        }),
      );
      await refreshMemory();
      setNotice("Core memory disimpan oleh Context.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const panel = {
    border: "1px solid #d8d8d8",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  } as const;
  const button = {
    padding: "7px 10px",
    border: "1px solid #bbb",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
  } as const;

  return (
    <main
      style={{
        maxWidth: 1480,
        margin: "0 auto",
        padding: 24,
        fontFamily: "sans-serif",
        color: "#191919",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div>
          <Link href="/" style={{ color: "inherit" }}>
            ← Ai
          </Link>
          <h1 style={{ marginBottom: 4 }}>Space</h1>
          <p style={{ marginTop: 0, color: "#666" }}>
            Composition lives here. Memory, files, and durable execution remain linked to their
            owner services.
          </p>
        </div>
        <span style={{ fontSize: 12, color: "#666" }}>workspace: {WORKSPACE_ID}</span>
      </header>

      {error !== null ? (
        <p role="alert" style={{ padding: 10, background: "#fff0f0", borderRadius: 8 }}>
          {error}
        </p>
      ) : null}
      {notice !== null ? (
        <p style={{ padding: 10, background: "#f3f7f3", borderRadius: 8 }}>{notice}</p>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0,1fr) 360px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <aside style={panel}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Pages</h2>
          <form onSubmit={createPage} style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <input
              value={newPageTitle}
              onChange={(event) => setNewPageTitle(event.target.value)}
              placeholder="New page"
              style={{ padding: 9, border: "1px solid #ccc", borderRadius: 8 }}
            />
            <button type="submit" style={button}>
              Create page
            </button>
          </form>
          <div style={{ display: "grid", gap: 6 }}>
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setSelectedPageId(page.id)}
                style={{
                  ...button,
                  textAlign: "left",
                  background: page.id === selectedPageId ? "#f1f1f1" : "#fff",
                }}
              >
                <strong>{page.title}</strong>
                <br />
                <small>
                  v{page.version} · {page.scope}
                </small>
              </button>
            ))}
          </div>
        </aside>

        <section style={panel}>
          {document === null ? (
            <p>Create or select a page.</p>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>{document.page.title}</h2>
                  <small>page v{document.page.version}</small>
                </div>
                <button type="button" style={button} onClick={() => void renamePage()}>
                  Rename
                </button>
              </div>

              <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                {document.blocks.map((block, index) => (
                  <article
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    style={{
                      border:
                        selectedBlockId === block.id ? "2px solid #555" : "1px solid #ddd",
                      borderRadius: 10,
                      padding: 14,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      <small>
                        {block.type} · block v{block.version}
                      </small>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          style={button}
                          disabled={index === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            void moveBlock(block, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          style={button}
                          disabled={index === document.blocks.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            void moveBlock(block, 1);
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          style={button}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteBlock(block);
                          }}
                        >
                          Delete
                        </button>
                      </span>
                    </div>
                    {blockPreview(block)}
                  </article>
                ))}
              </div>

              <div style={{ marginTop: 22, borderTop: "1px solid #ddd", paddingTop: 16 }}>
                <h3>Add block</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {BLOCK_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      style={{ ...button, background: kind === draftKind ? "#eee" : "#fff" }}
                      onClick={() => chooseKind(kind)}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
                <textarea
                  value={draftJson}
                  onChange={(event) => setDraftJson(event.target.value)}
                  rows={9}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: 10,
                  }}
                />
                <button
                  type="button"
                  style={{ ...button, marginTop: 8 }}
                  onClick={() => void addBlock()}
                >
                  Add {draftKind}
                </button>
              </div>
            </>
          )}
        </section>

        <aside style={{ display: "grid", gap: 16 }}>
          <section style={panel}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Block inspector</h2>
            {selectedBlock === null ? (
              <p>Select a block.</p>
            ) : (
              <>
                <small>
                  {selectedBlock.id} · {selectedBlock.type} · v{selectedBlock.version}
                </small>
                <textarea
                  value={inspectorJson}
                  onChange={(event) => setInspectorJson(event.target.value)}
                  rows={15}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 10,
                    fontFamily: "monospace",
                    fontSize: 12,
                    padding: 10,
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" style={button} onClick={() => void saveBlock()}>
                    Save block
                  </button>
                  <button type="button" style={button} onClick={() => void resolveBlock()}>
                    Resolve link
                  </button>
                </div>
                {resolution !== null ? (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      fontSize: 11,
                      background: "#f6f6f6",
                      padding: 10,
                      borderRadius: 8,
                    }}
                  >
                    {JSON.stringify(resolution, null, 2)}
                  </pre>
                ) : null}
              </>
            )}
          </section>

          <section style={panel}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Context core memory</h2>
            <p style={{ fontSize: 12, color: "#666" }}>
              Editor proxy only. Values are stored by Context, not Space.
            </p>
            <div style={{ marginBottom: 10 }}>
              {memory.blocks.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  style={{ ...button, margin: 2 }}
                  onClick={() => {
                    setMemoryLabel(item.label);
                    setMemoryDescription(item.description);
                    setMemoryValue(item.value);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <form onSubmit={saveMemory} style={{ display: "grid", gap: 8 }}>
              <input
                value={memoryLabel}
                onChange={(event) => setMemoryLabel(event.target.value)}
                placeholder="label"
              />
              <input
                value={memoryDescription}
                onChange={(event) => setMemoryDescription(event.target.value)}
                placeholder="description"
              />
              <textarea
                value={memoryValue}
                onChange={(event) => setMemoryValue(event.target.value)}
                rows={7}
                placeholder="Context-owned value"
              />
              <button type="submit" style={button}>
                Save to Context
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}
