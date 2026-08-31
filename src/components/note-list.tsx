"use client";

import { cn } from "@/lib/utils";
import type { NoteSummary } from "@/lib/types";

export function NoteList({
  notes,
  selected,
  onSelect,
}: {
  notes: NoteSummary[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 overflow-y-auto">
      {notes.map((note) => (
        <button
          key={note.id}
          onClick={() => onSelect(note.id)}
          className={cn(
            "rounded-md border px-3 py-2 text-left text-sm transition-colors",
            note.id === selected
              ? "bg-accent text-accent-foreground"
              : "bg-card hover:bg-muted",
          )}
        >
          <span className="block truncate">{note.title || "Untitled"}</span>
          <span className="text-xs text-muted-foreground">
            {note.cardCount} card{note.cardCount === 1 ? "" : "s"} · v
            {note.version}
          </span>
        </button>
      ))}
    </nav>
  );
}
