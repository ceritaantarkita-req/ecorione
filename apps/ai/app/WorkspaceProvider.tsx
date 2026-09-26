"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_WORKSPACE_ID, type WorkspaceId } from "@ecorione/shared-schema";
import {
  WORKSPACE_QUERY_KEY,
  WORKSPACE_STORAGE_KEY,
  resolveWorkspaceId,
} from "../lib/workspace-selection";

type WorkspaceContextValue = {
  readonly workspaceId: WorkspaceId;
  readonly ready: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: DEFAULT_WORKSPACE_ID,
  ready: false,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState<WorkspaceId>(DEFAULT_WORKSPACE_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let storedWorkspace: string | null = null;
    try {
      storedWorkspace = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    } catch {
      // Browser storage is optional; URL/default selection remains available.
    }

    const nextWorkspace = resolveWorkspaceId(
      params.get(WORKSPACE_QUERY_KEY),
      storedWorkspace,
    );
    setWorkspaceId(nextWorkspace);
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspace);
    } catch {
      // The in-memory Workspace selection remains authoritative for this page load.
    }
    setReady(true);
  }, []);

  const value = useMemo(
    () => ({ workspaceId, ready }),
    [ready, workspaceId],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}
