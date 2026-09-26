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
import { readJson } from "../../lib/client-response";
import { DocumentPanel, InspectorPanel, PagesRail } from "./SpacePageSections";
import styles from "./Space.module.css";
import { templateFor } from "./space-page-model";

const WORKSPACE_ID = "ws_personal";

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
  const [pendingMutation, setPendingMutation] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);
  const selectedPageIdRef = useRef<string | null>(null);
  const pageRequestRef = useRef(0);
  const pagesRequestRef = useRef(0);
  const memoryRequestRef = useRef(0);

  const selectedBlock = useMemo(
    () => document?.blocks.find((block) => block.id === selectedBlockId) ?? null,
    [document, selectedBlockId],
  );

  function beginMutation(action: string): boolean {
    if (createPageInFlightRef.current || mutationInFlightRef.current) return false;
    mutationInFlightRef.current = true;
    setPendingMutation(action);
    return true;
  }

  function finishMutation(): void {
    mutationInFlightRef.current = false;
    setPendingMutation(null);
  }

  function selectPage(id: string): void {
    if (selectedPageIdRef.current === id) return;
    pageRequestRef.current += 1;
    selectedPageIdRef.current = id;
    setSelectedPageId(id);
    setDocument(null);
    setSelectedBlockId(null);
    setDeleteConfirmId(null);
    setResolution(null);
    setRenaming(false);
  }

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
    const requestId = ++pagesRequestRef.current;
    try {
      const response = await fetch(`/api/space/pages?workspaceId=${WORKSPACE_ID}`, {
        cache: "no-store",
      });
      const next = (await readJson<{ pages: SpacePage[] }>(response)).pages;
      if (requestId !== pagesRequestRef.current) return;
      setPages(next);
      setSelectedPageId((current) =>
        current !== null && next.some((page) => page.id === current)
          ? current
          : (next[0]?.id ?? null),
      );
      setError(null);
    } catch (err) {
      if (requestId === pagesRequestRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const refreshMemory = useCallback(async () => {
    const requestId = ++memoryRequestRef.current;
    try {
      const response = await fetch(
        "/api/space/core-memory?scope=personal&maxSensitivity=RESTRICTED",
        { cache: "no-store" },
      );
      const next = await readJson<CoreMemory>(response);
      if (requestId !== memoryRequestRef.current) return;
      setMemory(next);
    } catch (err) {
      if (requestId === memoryRequestRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
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
    if (
      newPageTitle.trim().length === 0 ||
      createPageInFlightRef.current ||
      mutationInFlightRef.current
    )
      return;
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
      selectPage(page.id);
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
    if (document === null || !beginMutation("add-block")) return;
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
    } finally {
      finishMutation();
    }
  }

  async function saveBlock() {
    if (document === null || selectedBlock === null || !beginMutation("save-block")) return;
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
    } finally {
      finishMutation();
    }
  }

  async function deleteBlock(block: SpaceBlock) {
    if (document === null || !beginMutation("delete-block")) return;
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
    } finally {
      finishMutation();
    }
  }

  async function moveBlock(block: SpaceBlock, delta: -1 | 1) {
    if (document === null) return;
    const index = document.blocks.findIndex((item) => item.id === block.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= document.blocks.length) return;
    if (!beginMutation("move-block")) return;
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
    } finally {
      finishMutation();
    }
  }

  async function resolveBlock() {
    if (selectedBlock === null || !beginMutation("resolve-block")) return;
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
    } finally {
      finishMutation();
    }
  }

  async function renamePage(event: FormEvent) {
    event.preventDefault();
    if (document === null) return;
    const title = renameDraft.trim();
    if (title.length === 0 || !beginMutation("rename-page")) return;
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
    } finally {
      finishMutation();
    }
  }

  async function saveMemory(event: FormEvent) {
    event.preventDefault();
    if (!beginMutation("save-memory")) return;
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
    } finally {
      finishMutation();
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
        <PagesRail
          pages={pages}
          selectedPageId={selectedPageId}
          newPageTitle={newPageTitle}
          creatingPage={creatingPage}
          pendingMutation={pendingMutation}
          onCreatePage={createPage}
          onNewPageTitleChange={setNewPageTitle}
          onSelectPage={selectPage}
        />
        <DocumentPanel
          document={document}
          renaming={renaming}
          renameDraft={renameDraft}
          selectedBlockId={selectedBlockId}
          draftKind={draftKind}
          draftJson={draftJson}
          deleteConfirmId={deleteConfirmId}
          pendingMutation={pendingMutation}
          onRenamePage={renamePage}
          onRenameDraftChange={setRenameDraft}
          onCancelRename={() => {
            if (document !== null) setRenameDraft(document.page.title);
            setRenaming(false);
          }}
          onStartRename={() => setRenaming(true)}
          onSelectBlock={(blockId) => {
            setDeleteConfirmId(null);
            setSelectedBlockId(blockId);
          }}
          onMoveBlock={(block, delta) => void moveBlock(block, delta)}
          onRequestDelete={(block) => {
            if (deleteConfirmId === block.id) {
              void deleteBlock(block);
            } else {
              setDeleteConfirmId(block.id);
              setNotice("Klik Confirm delete sekali lagi untuk menghapus block.");
            }
          }}
          onChooseKind={chooseKind}
          onDraftJsonChange={setDraftJson}
          onAddBlock={() => void addBlock()}
        />
        <InspectorPanel
          selectedBlock={selectedBlock}
          inspectorJson={inspectorJson}
          resolution={resolution}
          memory={memory}
          memoryLabel={memoryLabel}
          memoryDescription={memoryDescription}
          memoryValue={memoryValue}
          pendingMutation={pendingMutation}
          onInspectorJsonChange={setInspectorJson}
          onSaveBlock={() => void saveBlock()}
          onResolveBlock={() => void resolveBlock()}
          onSelectMemory={(label, description, value) => {
            setMemoryLabel(label);
            setMemoryDescription(description);
            setMemoryValue(value);
          }}
          onMemoryLabelChange={setMemoryLabel}
          onMemoryDescriptionChange={setMemoryDescription}
          onMemoryValueChange={setMemoryValue}
          onSaveMemory={saveMemory}
        />
      </div>
    </main>
  );
}
