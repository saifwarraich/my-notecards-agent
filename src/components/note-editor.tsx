"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Job, Note, SaveResult } from "@/lib/types";
import { RichEditor } from "./rich-editor";

const SAVE_MESSAGES: Record<SaveResult["reason"], string> = {
  queued: "Saved. Agent is reading the changes…",
  unchanged: "Nothing changed.",
  "no-new-material": "Saved. Too small a change to study.",
  "already-queued": "Saved. Agent run already in flight.",
};

export function NoteEditor({
  noteId,
  onSaved,
  onDeleted,
}: {
  noteId: string;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    api<{ note: Note; jobs: Job[] }>(`/api/notes/${noteId}`)
      .then((data) => {
        if (!active) return;
        setNote(data.note);
        setTitle(data.note.title);
        setBody(data.note.body);
        setBodyText(data.note.bodyText);
        setJobs(data.jobs);
      })
      .catch(() => {
        // api() already showed the toast; the editor stays in its loading state.
      });
    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [noteId]);

  // While a run is in flight, poll until the agent settles.
  function pollUntilSettled() {
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      let data: { jobs: Job[] };
      try {
        data = await api<{ jobs: Job[] }>(`/api/notes/${noteId}`);
      } catch {
        // api() already surfaced the error; stop rather than hammering.
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      setJobs(data.jobs);
      const busy = data.jobs.some(
        (j: Job) => j.status === "pending" || j.status === "running",
      );
      if (!busy || ticks > 40) {
        if (pollRef.current) clearInterval(pollRef.current);
        onSaved();
        const latest = data.jobs[0] as Job | undefined;
        if (latest?.status === "done") {
          toast.success(
            latest.cardsCreated > 0
              ? `Agent made ${latest.cardsCreated} card${latest.cardsCreated === 1 ? "" : "s"}.`
              : "Agent found nothing new worth a card.",
          );
        } else if (latest?.status === "failed") {
          toast.error(`Agent run failed: ${latest.error}`);
        }
      }
    }, 1500);
  }

  async function save() {
    setSaving(true);
    try {
      const data = await api<SaveResult>(`/api/notes/${noteId}`, {
        method: "PUT",
        json: { title, body, bodyText },
      });
      setNote(data.note);
      toast(SAVE_MESSAGES[data.reason]);
      onSaved();
      if (data.reason === "queued" || data.reason === "already-queued") {
        pollUntilSettled();
      }
    } catch {
      // api() already showed the toast.
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await api(`/api/notes?id=${noteId}`, { method: "DELETE" });
    toast("Note deleted.");
    onDeleted();
  }

  // Cmd/Ctrl+S is the whole interaction model — save is what triggers the agent.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!note) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }

  const activeJob = jobs.find(
    (j) => j.status === "pending" || j.status === "running",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="border-0 shadow-none text-lg font-heading focus-visible:ring-0 px-1"
        />
        {activeJob ? (
          <span
            className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
            title={`Agent is working on version ${note.version}`}
          >
            <Loader2 className="size-3.5 animate-spin" />
            <span className="hidden sm:inline">agent working</span>
          </span>
        ) : null}
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Save />
          )}
          Save
        </Button>
        <Button onClick={remove} variant="ghost" size="icon-sm">
          <Trash2 className="text-destructive" />
        </Button>
      </div>

      <RichEditor
        noteId={noteId}
        initialContent={note.body}
        onChange={(value) => {
          setBody(value.html);
          setBodyText(value.text);
        }}
      />
    </div>
  );
}
