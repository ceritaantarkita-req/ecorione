from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"{label} target not found")
    path.write_text(text.replace(old, new, 1))


chat = Path("apps/ai/app/page.tsx")
replace_once(
    chat,
    '''  const [sending, setSending] = useState(false);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);''',
    '''  const [sending, setSending] = useState(false);
  const [forgettingId, setForgettingId] = useState<string | null>(null);
  const sendInFlightRef = useRef(false);
  const forgetInFlightRef = useRef<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);''',
    "chat request refs",
)
replace_once(
    chat,
    '''    if (!hydrated || trimmed.length === 0 || sending) return;
    if (target === "hosted" && hostedAvailable !== true) {''',
    '''    if (!hydrated || trimmed.length === 0 || sending || sendInFlightRef.current) return;
    if (target === "hosted" && hostedAvailable !== true) {''',
    "chat send guard",
)
replace_once(
    chat,
    '''    setTurns((prev) => [...prev, { kind: "user", id: nextTurnId(), text: trimmed }]);
    setDraft("");
    setSending(true);''',
    '''    sendInFlightRef.current = true;
    setTurns((prev) => [...prev, { kind: "user", id: nextTurnId(), text: trimmed }]);
    setDraft("");
    setSending(true);''',
    "chat send lock",
)
replace_once(
    chat,
    '''    } finally {
      setSending(false);
    }
  }

  async function forgetFact(factId: string): Promise<void> {
    if (forgettingId !== null) return;
    setForgettingId(factId);''',
    '''    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  }

  async function forgetFact(factId: string): Promise<void> {
    if (forgettingId !== null || forgetInFlightRef.current !== null) return;
    forgetInFlightRef.current = factId;
    setForgettingId(factId);''',
    "chat forget lock",
)
replace_once(
    chat,
    '''    } finally {
      setForgettingId(null);
    }
  }
  function handleSubmit''',
    '''    } finally {
      forgetInFlightRef.current = null;
      setForgettingId(null);
    }
  }
  function handleSubmit''',
    "chat forget unlock",
)

space = Path("apps/ai/app/space/page.tsx")
replace_once(
    space,
    'import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";',
    'import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";',
    "space useRef import",
)
replace_once(
    space,
    '''  const [notice, setNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);''',
    '''  const [notice, setNotice] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const createPageInFlightRef = useRef(false);
  const selectedPageIdRef = useRef<string | null>(null);
  const pageRequestRef = useRef(0);''',
    "space request state",
)
old_load = '''  const loadPage = useCallback(async (id: string) => {
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
  }, []);'''
new_load = '''  const loadPage = useCallback(async (id: string) => {
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
  }, []);'''
replace_once(space, old_load, new_load, "space stale page load")
replace_once(
    space,
    '''  useEffect(() => {
    if (selectedPageId !== null) void loadPage(selectedPageId);
    else setDocument(null);
  }, [loadPage, selectedPageId]);''',
    '''  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
  }, [selectedPageId]);

  useEffect(() => {
    if (selectedPageId !== null) {
      void loadPage(selectedPageId);
    } else {
      pageRequestRef.current += 1;
      setDocument(null);
    }
  }, [loadPage, selectedPageId]);''',
    "space selection request sync",
)
replace_once(
    space,
    '''  async function createPage(event: FormEvent) {
    event.preventDefault();
    if (newPageTitle.trim().length === 0) return;
    try {''',
    '''  async function createPage(event: FormEvent) {
    event.preventDefault();
    if (newPageTitle.trim().length === 0 || createPageInFlightRef.current) return;
    createPageInFlightRef.current = true;
    setCreatingPage(true);
    try {''',
    "space create lock",
)
replace_once(
    space,
    '''    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function chooseKind''',
    '''    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      createPageInFlightRef.current = false;
      setCreatingPage(false);
    }
  }

  function chooseKind''',
    "space create unlock",
)
replace_once(
    space,
    '''              disabled={newPageTitle.trim().length === 0}
            >
              Create page
            </button>''',
    '''              disabled={newPageTitle.trim().length === 0 || creatingPage}
            >
              {creatingPage ? "Creating…" : "Create page"}
            </button>''',
    "space create button",
)
replace_once(
    space,
    '''                      onClick={() => setSelectedBlockId(block.id)}''',
    '''                      onClick={() => {
                        setDeleteConfirmId(null);
                        setSelectedBlockId(block.id);
                      }}''',
    "space block selection clears delete",
)
replace_once(
    space,
    '''                              event.stopPropagation();
                              setSelectedBlockId(block.id);''',
    '''                              event.stopPropagation();
                              setDeleteConfirmId(null);
                              setSelectedBlockId(block.id);''',
    "space inspect clears delete",
)
