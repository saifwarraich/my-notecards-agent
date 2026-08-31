"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import type { NoteSummary } from "@/lib/types";

type NotesContext = {
  notes: NoteSummary[];
  selected: string | null;
  select: (id: string | null) => void;
  reload: () => Promise<void>;
  create: () => Promise<void>;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const Context = createContext<NotesContext | null>(null);

/**
 * Holds the note list and which one is open. It lives above the header so the
 * header can own the mobile drawer trigger, rather than the notes page having
 * to reach upwards into the layout.
 */
export function NotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const onNotesPage = pathname === "/";

  const reload = useCallback(async () => {
    const rows = await api<NoteSummary[]>("/api/notes");
    setNotes(rows);
    setSelected((current) => current ?? rows[0]?.id ?? null);
  }, []);

  useEffect(() => {
    // Review and Agent do not need the list, so it is only fetched here.
    if (!onNotesPage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload().catch(() => {
      // api() already showed the toast.
    });
  }, [onNotesPage, reload]);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setDrawerOpen(false);
  }, []);

  const create = useCallback(async () => {
    const note = await api<NoteSummary>("/api/notes", { method: "POST" });
    await reload();
    setSelected(note.id);
    setDrawerOpen(false);
  }, [reload]);

  const value = useMemo(
    () => ({
      notes,
      selected,
      select,
      reload,
      create,
      drawerOpen,
      setDrawerOpen,
    }),
    [notes, selected, select, reload, create, drawerOpen],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotes() {
  const context = useContext(Context);
  if (!context) throw new Error("useNotes must be used inside NotesProvider");
  return context;
}
