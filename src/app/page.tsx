"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NoteEditor } from "@/components/note-editor";
import { NoteList } from "@/components/note-list";
import { api } from "@/lib/api";
import type { NoteSummary } from "@/lib/types";

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadNotes = useCallback(async () => {
    const rows = await api<NoteSummary[]>("/api/notes");
    setNotes(rows);
    setSelected((current) => current ?? rows[0]?.id ?? null);
  }, []);

  useEffect(() => {
    // The state update lands after an await, not synchronously in the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotes().catch(() => {
      // api() already showed the toast.
    });
  }, [loadNotes]);

  async function newNote() {
    const note = await api<NoteSummary>("/api/notes", { method: "POST" });
    await loadNotes();
    setSelected(note.id);
    setDrawerOpen(false);
  }

  function pick(id: string) {
    setSelected(id);
    setDrawerOpen(false);
  }

  const sidebar = (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <Button onClick={newNote} size="sm" variant="secondary" className="shrink-0">
        <Plus /> New note
      </Button>
      {/* Only this list scrolls — a long note library never pushes the page. */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <NoteList notes={notes} selected={selected} onSelect={pick} />
      </div>
    </div>
  );

  const current = notes.find((n) => n.id === selected);

  return (
    <div className="grid min-h-0 flex-1 gap-4 pb-4 md:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-0 flex-col md:flex">{sidebar}</aside>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
        {/* Mobile-only bar: the drawer trigger plus which note is open. */}
        <div className="flex shrink-0 items-center gap-2 border-b p-2 md:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Show notes">
                <PanelLeft />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[85vw] flex-col sm:w-80">
              <SheetHeader className="shrink-0">
                <SheetTitle>Notes</SheetTitle>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
                {sidebar}
              </div>
            </SheetContent>
          </Sheet>
          <span className="truncate text-sm text-muted-foreground">
            {current?.title || "Notes"}
          </span>
        </div>

        {selected ? (
          <NoteEditor
            key={selected}
            noteId={selected}
            onSaved={loadNotes}
            onDeleted={() => {
              setSelected(null);
              void loadNotes();
            }}
          />
        ) : (
          <p className="p-6 text-muted-foreground">Make a note to get started.</p>
        )}
      </section>
    </div>
  );
}
