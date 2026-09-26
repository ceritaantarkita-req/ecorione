"use client";

import type { FormEvent } from "react";
import type {
  CoreMemory,
  SpaceBlock,
  SpaceBlockReferenceResolution,
  SpaceBlockType,
  SpaceDocument,
  SpacePage,
} from "@ecorione/shared-schema";
import styles from "./Space.module.css";
import { BLOCK_KINDS } from "./space-page-model";

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

type PagesRailProps = {
  pages: SpacePage[];
  selectedPageId: string | null;
  newPageTitle: string;
  creatingPage: boolean;
  pendingMutation: string | null;
  onCreatePage: (event: FormEvent<HTMLFormElement>) => void;
  onNewPageTitleChange: (value: string) => void;
  onSelectPage: (id: string) => void;
};

export function PagesRail(props: PagesRailProps) {
  return (
    <aside className={styles.rail}>
      <h2 className={styles.panelTitle}>Pages</h2>
      <form onSubmit={props.onCreatePage} className={styles.createForm}>
        <input
          className={styles.input}
          value={props.newPageTitle}
          onChange={(event) => props.onNewPageTitleChange(event.target.value)}
          placeholder="New page"
          aria-label="New page title"
        />
        <button
          type="submit"
          className={styles.button}
          disabled={
            props.newPageTitle.trim().length === 0 ||
            props.creatingPage ||
            props.pendingMutation !== null
          }
        >
          {props.creatingPage ? "Creating…" : "Create page"}
        </button>
      </form>
      <div className={styles.pageList}>
        {props.pages.length === 0 ? (
          <p className={styles.help}>No pages yet.</p>
        ) : (
          props.pages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => props.onSelectPage(page.id)}
              className={`${styles.pageButton} ${
                page.id === props.selectedPageId ? styles.pageButtonActive : ""
              }`}
              aria-pressed={page.id === props.selectedPageId}
              disabled={props.creatingPage || props.pendingMutation !== null}
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
  );
}

type DocumentPanelProps = {
  document: SpaceDocument | null;
  renaming: boolean;
  renameDraft: string;
  selectedBlockId: string | null;
  draftKind: SpaceBlockType;
  draftJson: string;
  deleteConfirmId: string | null;
  pendingMutation: string | null;
  onRenamePage: (event: FormEvent<HTMLFormElement>) => void;
  onRenameDraftChange: (value: string) => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onSelectBlock: (blockId: string) => void;
  onMoveBlock: (block: SpaceBlock, delta: -1 | 1) => void;
  onRequestDelete: (block: SpaceBlock) => void;
  onChooseKind: (kind: SpaceBlockType) => void;
  onDraftJsonChange: (value: string) => void;
  onAddBlock: () => void;
};

export function DocumentPanel(props: DocumentPanelProps) {
  return (
    <section className={styles.document}>
      {props.document === null ? (
        <div className={styles.documentEmpty}>Create or select a page.</div>
      ) : (
        <>
          <div className={styles.documentHeader}>
            {props.renaming ? (
              <form className={styles.renameRow} onSubmit={props.onRenamePage}>
                <input
                  className={styles.input}
                  value={props.renameDraft}
                  onChange={(event) => props.onRenameDraftChange(event.target.value)}
                  aria-label="Page title"
                  disabled={props.pendingMutation !== null}
                  autoFocus
                />
                <button
                  type="submit"
                  className={styles.buttonPrimary}
                  disabled={
                    props.renameDraft.trim().length === 0 || props.pendingMutation !== null
                  }
                >
                  Save title
                </button>
                <button type="button" className={styles.button} onClick={props.onCancelRename}>
                  Cancel
                </button>
              </form>
            ) : (
              <div>
                <h2>{props.document.page.title}</h2>
                <span className={styles.meta}>page v{props.document.page.version}</span>
              </div>
            )}
            {!props.renaming ? (
              <button
                type="button"
                className={styles.button}
                disabled={props.pendingMutation !== null}
                onClick={props.onStartRename}
              >
                Rename
              </button>
            ) : null}
          </div>

          <div className={styles.blocks}>
            {props.document.blocks.length === 0 ? (
              <div className={styles.documentEmpty}>This page has no blocks yet.</div>
            ) : (
              props.document.blocks.map((block, index) => (
                <article
                  key={block.id}
                  onClick={() => props.onSelectBlock(block.id)}
                  className={`${styles.block} ${
                    props.selectedBlockId === block.id ? styles.blockSelected : ""
                  }`}
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
                        aria-pressed={props.selectedBlockId === block.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onSelectBlock(block.id);
                        }}
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        disabled={index === 0 || props.pendingMutation !== null}
                        aria-label={`Move ${block.type} block up`}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onMoveBlock(block, -1);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        disabled={
                          index === props.document!.blocks.length - 1 ||
                          props.pendingMutation !== null
                        }
                        aria-label={`Move ${block.type} block down`}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onMoveBlock(block, 1);
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconButton} ${styles.deleteButton} ${
                          props.deleteConfirmId === block.id ? styles.deleteButtonConfirm : ""
                        }`}
                        disabled={props.pendingMutation !== null}
                        aria-label={
                          props.deleteConfirmId === block.id
                            ? `Confirm delete ${block.type} block`
                            : `Delete ${block.type} block`
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onRequestDelete(block);
                        }}
                      >
                        {props.deleteConfirmId === block.id ? "Confirm delete" : "Delete"}
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
                  className={`${styles.kindButton} ${
                    kind === props.draftKind ? styles.kindButtonActive : ""
                  }`}
                  onClick={() => props.onChooseKind(kind)}
                  disabled={props.pendingMutation !== null}
                >
                  {kind}
                </button>
              ))}
            </div>
            <textarea
              className={styles.textarea}
              value={props.draftJson}
              onChange={(event) => props.onDraftJsonChange(event.target.value)}
              rows={9}
              spellCheck={false}
              aria-label={`${props.draftKind} block JSON`}
              disabled={props.pendingMutation !== null}
            />
            <div className={styles.editorActions}>
              <button
                type="button"
                className={styles.buttonPrimary}
                disabled={props.pendingMutation !== null}
                onClick={props.onAddBlock}
              >
                Add {props.draftKind}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

type InspectorPanelProps = {
  selectedBlock: SpaceBlock | null;
  inspectorJson: string;
  resolution: SpaceBlockReferenceResolution | null;
  memory: CoreMemory;
  memoryLabel: string;
  memoryDescription: string;
  memoryValue: string;
  pendingMutation: string | null;
  onInspectorJsonChange: (value: string) => void;
  onSaveBlock: () => void;
  onResolveBlock: () => void;
  onSelectMemory: (label: string, description: string, value: string) => void;
  onMemoryLabelChange: (value: string) => void;
  onMemoryDescriptionChange: (value: string) => void;
  onMemoryValueChange: (value: string) => void;
  onSaveMemory: (event: FormEvent<HTMLFormElement>) => void;
};

export function InspectorPanel(props: InspectorPanelProps) {
  return (
    <aside className={styles.inspector}>
      <div className={styles.inspectorStack}>
        <section className={styles.inspectorSection}>
          <h2 className={styles.panelTitle}>Block inspector</h2>
          {props.selectedBlock === null ? (
            <p className={styles.help}>Select a block to inspect its owner-backed body.</p>
          ) : (
            <>
              <div className={styles.meta}>
                {props.selectedBlock.id} · {props.selectedBlock.type} · v
                {props.selectedBlock.version}
              </div>
              <textarea
                className={styles.textarea}
                value={props.inspectorJson}
                onChange={(event) => props.onInspectorJsonChange(event.target.value)}
                rows={15}
                spellCheck={false}
                aria-label="Selected block JSON"
                disabled={props.pendingMutation !== null}
              />
              <div className={styles.inspectorActions}>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  disabled={props.pendingMutation !== null}
                  onClick={props.onSaveBlock}
                >
                  Save block
                </button>
                <button
                  type="button"
                  className={styles.button}
                  disabled={props.pendingMutation !== null}
                  onClick={props.onResolveBlock}
                >
                  Resolve link
                </button>
              </div>
              {props.resolution !== null ? (
                <pre className={styles.resolution}>
                  {JSON.stringify(props.resolution, null, 2)}
                </pre>
              ) : null}
            </>
          )}
        </section>

        <section className={styles.inspectorSection}>
          <h2 className={styles.panelTitle}>Context core memory</h2>
          <p className={styles.help}>Editor proxy only. Values are stored by Context, not Space.</p>
          <div className={styles.memoryList}>
            {props.memory.blocks.map((item) => (
              <button
                key={item.label}
                type="button"
                className={styles.memoryButton}
                disabled={props.pendingMutation !== null}
                onClick={() => props.onSelectMemory(item.label, item.description, item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <form onSubmit={props.onSaveMemory} className={styles.memoryForm}>
            <input
              className={styles.input}
              value={props.memoryLabel}
              onChange={(event) => props.onMemoryLabelChange(event.target.value)}
              placeholder="label"
              aria-label="Core memory label"
              disabled={props.pendingMutation !== null}
            />
            <input
              className={styles.input}
              value={props.memoryDescription}
              onChange={(event) => props.onMemoryDescriptionChange(event.target.value)}
              placeholder="description"
              aria-label="Core memory description"
              disabled={props.pendingMutation !== null}
            />
            <textarea
              className={styles.textarea}
              value={props.memoryValue}
              onChange={(event) => props.onMemoryValueChange(event.target.value)}
              rows={7}
              placeholder="Context-owned value"
              aria-label="Core memory value"
              disabled={props.pendingMutation !== null}
            />
            <button
              type="submit"
              className={styles.buttonPrimary}
              disabled={props.pendingMutation !== null}
            >
              {props.pendingMutation === "save-memory" ? "Saving…" : "Save to Context"}
            </button>
          </form>
        </section>
      </div>
    </aside>
  );
}
