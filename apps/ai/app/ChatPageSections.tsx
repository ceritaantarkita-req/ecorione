import type { ChatCost, MemoryUsed } from "@ecorione/shared-schema";
import type { ChatTurn } from "../lib/chat-history";

function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

/** shared-telemetry already returns 0..100. */
function formatPct(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function PanelToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="ai-panel__toggle-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d={collapsed ? "M12 6.5v7M8 8.6l2 1.4-2 1.4" : "M12 6.5v7M10 8.6l-2 1.4 2 1.4"} />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg className="ai-tool-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 3h6l3 3v11H6Z" />
      <path d="M12 3v3h3" />
    </svg>
  );
}

export function PhotoIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="3" y="4.5" width="14" height="11" rx="1.5" />
      <circle cx="7.3" cy="8.3" r="1.3" />
      <path d="M4 14 8 10l3 3 2.5-2.5L16.5 14" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 6.2c0-.66.6-1.2 1.2-1.2h3.4l1.4 1.6h6.8c.66 0 1.2.54 1.2 1.2v6.4c0 .66-.54 1.2-1.2 1.2H4.2C3.54 15.4 3 14.86 3 14.2Z" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg className="ai-menu-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M12.9 3.9 16.1 7.1 7 16.2l-3.5.7.7-3.5Z" />
      <path d="M11.4 5.4 14.6 8.6" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg
      className="ai-chip__remove-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg
      className="ai-model-select__chevron"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg className="ai-send-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 15.5V4.5M10 4.5 5.3 9.2M10 4.5l4.7 4.7" />
    </svg>
  );
}

export function TurnView({ turn }: { turn: ChatTurn }) {
  if (turn.kind === "user") {
    return (
      <div className="ai-turn ai-turn--user">
        <div className="ai-bubble">{turn.text}</div>
      </div>
    );
  }
  if (turn.kind === "error") {
    return (
      <div className="ai-turn ai-turn--assistant" role="alert">
        <div className="ai-bubble ai-bubble--error">{turn.message}</div>
      </div>
    );
  }
  return (
    <div className="ai-turn ai-turn--assistant">
      <div className="ai-bubble">{turn.reply}</div>
      {turn.cost === undefined ? null : <RoutingLine cost={turn.cost} />}
    </div>
  );
}

function RoutingLine({ cost }: { cost: ChatCost }) {
  return (
    <div className="ai-routing">
      <span>
        Model: <span className="ai-routing__model">{cost.model}</span>
      </span>
      <span>·</span>
      <span>{cost.cacheHit ? "cache hit" : "cache miss"}</span>
      <span>·</span>
      <span>{formatUsd(cost.actualUsd)}</span>
      {cost.savedUsd > 0 ? (
        <>
          <span>·</span>
          <span className="ai-routing__savings">
            hemat {formatUsd(cost.savedUsd)} ({formatPct(cost.savedPct)})
          </span>
        </>
      ) : null}
    </div>
  );
}

export function MemoryPanel({
  memoryUsed,
  onForget,
  forgettingId,
}: {
  memoryUsed: MemoryUsed;
  onForget: (factId: string) => void;
  forgettingId: string | null;
}) {
  return (
    <>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Memori inti</div>
        {memoryUsed.coreMemoryBlocks.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada.</p>
        ) : (
          memoryUsed.coreMemoryBlocks.map((label, index) => (
            <div className="ai-core-block" key={`${label}-${index}`}>
              {label}
            </div>
          ))
        )}
      </div>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Fakta yang ditarik</div>
        {memoryUsed.recalledFacts.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada.</p>
        ) : (
          memoryUsed.recalledFacts.map((fact) => (
            <div className="ai-fact" key={fact.id}>
              <div className="ai-fact__body">
                <div className="ai-fact__text">{fact.text}</div>
                <div className="ai-fact__score">skor {fact.score.toFixed(2)}</div>
              </div>
              <button
                type="button"
                className="ecr-btn ecr-btn--secondary ai-forget-btn"
                onClick={() => onForget(fact.id)}
                disabled={forgettingId !== null}
              >
                {forgettingId === fact.id ? "Melupakan…" : "Lupakan"}
              </button>
            </div>
          ))
        )}
      </div>
      <div className="ai-panel__section">
        <div className="ai-panel__section-title">Ringkasan episodik</div>
        {memoryUsed.episodicSummaries.length === 0 ? (
          <p className="ai-panel__empty">Tidak ada.</p>
        ) : (
          memoryUsed.episodicSummaries.map((episode) => (
            <div className="ai-episode" key={episode.id}>
              {episode.text}
            </div>
          ))
        )}
      </div>
    </>
  );
}
