"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "@/components/note-editor";
import { NoteList } from "@/components/note-list";
import { api } from "@/lib/api";
import type { NoteSummary } from "@/lib/types";

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

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
  }

  return (
    <div className="grid flex-1 gap-4 md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-2">
        <Button onClick={newNote} size="sm" variant="secondary">
          <Plus /> New note
        </Button>
        <NoteList notes={notes} selected={selected} onSelect={setSelected} />
      </aside>

      <section className="min-h-[60vh] rounded-lg border bg-card">
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
          <p className="p-6 text-muted-foreground">
            Make a note to get started.
          </p>
        )}
      </section>
    </div>
  );
}
