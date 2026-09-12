"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  CoreMemory,
  SpaceBlock,
  SpaceBlockReferenceResolution,
  SpaceBlockType,
  SpaceDocument,
  SpacePage,
} from "@ecorione/shared-schema";
import styles from "./Space.module.css";

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
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }
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

function BlockPreview({ block }: { block: SpaceBlock }) {
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
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const createPageInFlightRef = useRef(false);
  const selectedPageIdRef = useRef<string | null>(null);
  const pageRequestRef = useRef(0);

  const selectedBlock = useMemo(
    () => document?.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [document, selectedBlockId],
  );

  const loadPage = useCallback(async (id: string) => {
    const requestId = ++pageRequestRef.current;
    try {
      const next = await readJson<SpaceDocument>(
        await fetch(`/api/space/pages/${encodeURIComponent(id)}?workspaceId=${WORKSPACE_ID}`, {
          cache: "no-store",
        }),
      );
      if (requestId !== pageRequestRef.current || selectedPageIdRef.current !== id) return;
      setDocument(next);
      setError(null);
    } catch (err) {
      if (requestId !== pageRequestRef.current || selectedPageIdRef.current !== id) return;
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
      setSelectedPageId((current) =>
        current !== null && next.some((page) => page.id === current)
          ? current
          : (next[0]?.id ?? null),
      );
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
    selectedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  useEffect(() => {
    if (selectedPageId !== null) {
      void loadPage(selectedPageId);
    } else {
      pageRequestRef.current += 1;
      setDocument(null);
    }
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

  useEffect(() => {
    setRenameDraft(document?.page.title ?? "");
    setRenaming(false);
  }, [document?.page.id, document?.page.title]);

  async function createPage(event: FormEvent) {
    event.preventDefault();
    if (newPageTitle.trim().length === 0 || createPageInFlightRef.current) return;
    createPageInFlightRef.current = true;
    setCreatingPage(true);
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      createPageInFlightRef.current = false;
      setCreatingPage(false);
    }
  }

  function chooseKind(kind: SpaceBlockType) {
    const template = templateFor(kind, document);
    if (template === null) {
      setError("Buat table block dulu sebelum database-view.");
      return;
    }
    setDraftKind(kind);
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
      setError(null);
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
      setError(null);
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
      setDeleteConfirmId(null);
      await loadPage(document.page.id);
      await refreshPages();
      setNotice("Block dihapus.");
      setError(null);
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
      setError(null);
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

  async function renamePage(event: FormEvent) {
    event.preventDefault();
    if (document === null) return;
    const title = renameDraft.trim();
    if (title.length === 0) return;
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
      setRenaming(false);
      setNotice("Judul page diperbarui.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveMemory(event: FormEvent) {
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
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Space</h1>
          <p>
            Composition lives here. Memory, files, and durable execution remain linked to their
            owner services.
          </p>
        </div>
        <span className={styles.workspaceId}>workspace · {WORKSPACE_ID}</span>
      </header>

      {error !== null ? (
        <p role="alert" className={`${styles.feedback} ${styles.error}`}>
          {error}
        </p>
      ) : null}
      {notice !== null ? (
        <p aria-live="polite" className={`${styles.feedback} ${styles.notice}`}>
          {notice}
        </p>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.rail}>
          <h2 className={styles.panelTitle}>Pages</h2>
          <form onSubmit={createPage} className={styles.createForm}>
            <input
              className={styles.input}
              value={newPageTitle}
              onChange={(event) => setNewPageTitle(event.target.value)}
              placeholder="New page"
              aria-label="New page title"
            />
            <button
              type="submit"
              className={styles.button}
              disabled={newPageTitle.trim().length === 0 || creatingPage}
            >
              {creatingPage ? "Creating…" : "Create page"}
            </button>
          </form>
          <div className={styles.pageList}>
            {pages.length === 0 ? (
              <p className={styles.help}>No pages yet.</p>
            ) : (
              pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setSelectedPageId(page.id)}
                  className={`${styles.pageButton} ${page.id === selectedPageId ? styles.pageButtonActive : ""}`}
                  aria-pressed={page.id === selectedPageId}
                >
                  <strong>{page.title}</strong>
                  <small>
                    v{page.version} · {page.scope}
                  </small>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={styles.document}>
          {document === null ? (
            <div className={styles.documentEmpty}>Create or select a page.</div>
          ) : (
            <>
              <div className={styles.documentHeader}>
                {renaming ? (
                  <form className={styles.renameRow} onSubmit={renamePage}>
                    <input
                      className={styles.input}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      aria-label="Page title"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className={styles.buttonPrimary}
                      disabled={renameDraft.trim().length === 0}
                    >
                      Save title
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => {
                        setRenameDraft(document.page.title);
                        setRenaming(false);
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div>
                    <h2>{document.page.title}</h2>
                    <span className={styles.meta}>page v{document.page.version}</span>
                  </div>
                )}
                {!renaming ? (
                  <button
                    type="button"
                    className={styles.button}
                    onClick={() => setRenaming(true)}
                  >
                    Rename
                  </button>
                ) : null}
              </div>

              <div className={styles.blocks}>
                {document.blocks.length === 0 ? (
                  <div className={styles.documentEmpty}>This page has no blocks yet.</div>
                ) : (
                  document.blocks.map((block, index) => (
                    <article
                      key={block.id}
                      onClick={() => {
                        setDeleteConfirmId(null);
                        setSelectedBlockId(block.id);
                      }}
                      className={`${styles.block} ${selectedBlockId === block.id ? styles.blockSelected : ""}`}
                    >
                      <div className={styles.blockToolbar}>
                        <span className={styles.blockMeta}>
                          {block.type} · block v{block.version}
                        </span>
                        <span className={styles.blockActions}>
                          <button
                            type="button"
                            className={`${styles.iconButton} ${styles.inspectButton}`}
                            aria-label={`Inspect ${block.type} block`}
                            aria-pressed={selectedBlockId === block.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteConfirmId(null);
                              setSelectedBlockId(block.id);
                            }}
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            disabled={index === 0}
                            aria-label={`Move ${block.type} block up`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void moveBlock(block, -1);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            disabled={index === document.blocks.length - 1}
                            aria-label={`Move ${block.type} block down`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void moveBlock(block, 1);
                            }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={`${styles.iconButton} ${styles.deleteButton} ${deleteConfirmId === block.id ? styles.deleteButtonConfirm : ""}`}
                            aria-label={
                              deleteConfirmId === block.id
                                ? `Confirm delete ${block.type} block`
                                : `Delete ${block.type} block`
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              if (deleteConfirmId === block.id) {
                                void deleteBlock(block);
                              } else {
                                setDeleteConfirmId(block.id);
                                setNotice(
                                  "Klik Confirm delete sekali lagi untuk menghapus block.",
                                );
                              }
                            }}
                          >
                            {deleteConfirmId === block.id ? "Confirm delete" : "Delete"}
                          </button>
                        </span>
                      </div>
                      <div className={styles.blockContent}>
                        <BlockPreview block={block} />
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className={styles.addBlock}>
                <h3>Add block</h3>
                <div className={styles.kindList}>
                  {BLOCK_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`${styles.kindButton} ${kind === draftKind ? styles.kindButtonActive : ""}`}
                      onClick={() => chooseKind(kind)}
                    >
                      {kind}
                    </button>
                  ))}
                </div>
                <textarea
                  className={styles.textarea}
                  value={draftJson}
                  onChange={(event) => setDraftJson(event.target.value)}
                  rows={9}
                  spellCheck={false}
                  aria-label={`${draftKind} block JSON`}
                />
                <div className={styles.editorActions}>
                  <button
                    type="button"
                    className={styles.buttonPrimary}
                    onClick={() => void addBlock()}
                  >
                    Add {draftKind}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className={styles.inspector}>
          <div className={styles.inspectorStack}>
            <section className={styles.inspectorSection}>
              <h2 className={styles.panelTitle}>Block inspector</h2>
              {selectedBlock === null ? (
                <p className={styles.help}>Select a block to inspect its owner-backed body.</p>
              ) : (
                <>
                  <div className={styles.meta}>
                    {selectedBlock.id} · {selectedBlock.type} · v{selectedBlock.version}
                  </div>
                  <textarea
                    className={styles.textarea}
                    value={inspectorJson}
                    onChange={(event) => setInspectorJson(event.target.value)}
                    rows={15}
                    spellCheck={false}
                    aria-label="Selected block JSON"
                  />
                  <div className={styles.inspectorActions}>
                    <button
                      type="button"
                      className={styles.buttonPrimary}
                      onClick={() => void saveBlock()}
                    >
                      Save block
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => void resolveBlock()}
                    >
                      Resolve link
                    </button>
                  </div>
                  {resolution !== null ? (
                    <pre className={styles.resolution}>
                      {JSON.stringify(resolution, null, 2)}
                    </pre>
                  ) : null}
                </>
              )}
            </section>

            <section className={styles.inspectorSection}>
              <h2 className={styles.panelTitle}>Context core memory</h2>
              <p className={styles.help}>
                Editor proxy only. Values are stored by Context, not Space.
              </p>
              <div className={styles.memoryList}>
                {memory.blocks.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={styles.memoryButton}
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
              <form onSubmit={saveMemory} className={styles.memoryForm}>
                <input
                  className={styles.input}
                  value={memoryLabel}
                  onChange={(event) => setMemoryLabel(event.target.value)}
                  placeholder="label"
                  aria-label="Core memory label"
                />
                <input
                  className={styles.input}
                  value={memoryDescription}
                  onChange={(event) => setMemoryDescription(event.target.value)}
                  placeholder="description"
                  aria-label="Core memory description"
                />
                <textarea
                  className={styles.textarea}
                  value={memoryValue}
                  onChange={(event) => setMemoryValue(event.target.value)}
                  rows={7}
                  placeholder="Context-owned value"
                  aria-label="Core memory value"
                />
                <button type="submit" className={styles.buttonPrimary}>
                  Save to Context
                </button>
              </form>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
