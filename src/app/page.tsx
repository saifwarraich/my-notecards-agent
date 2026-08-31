"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoteEditor } from "@/components/note-editor";
import { NoteList } from "@/components/note-list";
import { useNotes } from "@/components/notes-provider";

export default function NotesPage() {
  const { notes, selected, select, reload, create } = useNotes();

  return (
    <div className="grid min-h-0 flex-1 gap-4 pb-4 md:grid-cols-[240px_1fr]">
      {/* On mobile this list lives in the header's drawer instead. */}
      <aside className="hidden min-h-0 flex-col gap-2 md:flex">
        <Button onClick={create} size="sm" variant="secondary" className="shrink-0">
          <Plus /> New note
        </Button>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <NoteList notes={notes} selected={selected} onSelect={select} />
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
        {selected ? (
          <NoteEditor
            key={selected}
            noteId={selected}
            onSaved={reload}
            onDeleted={() => {
              select(null);
              void reload();
            }}
          />
        ) : (
          <p className="p-6 text-muted-foreground">Make a note to get started.</p>
        )}
      </section>
    </div>
  );
}
