"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Job } from "@/lib/types";

const STATUS_VARIANT = {
  done: "secondary",
  failed: "destructive",
  running: "outline",
  pending: "outline",
} as const;

/**
 * The demo centrepiece: what the agent actually did, tool call by tool call.
 */
export function JobTrace({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b px-4 py-3 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
        <span className="text-muted-foreground">
          {job.steps.length} tool call{job.steps.length === 1 ? "" : "s"} ·{" "}
          {job.cardsCreated} card{job.cardsCreated === 1 ? "" : "s"}
        </span>
        {job.model ? (
          <code className="ml-auto text-xs text-muted-foreground">
            {job.model}
          </code>
        ) : null}
      </button>

      {open ? (
        <div className="mt-3 space-y-2 pl-6">
          {job.error ? (
            <p className="text-xs text-destructive">{job.error}</p>
          ) : null}
          {job.trigger ? (
            <p className="text-xs text-muted-foreground">
              Handoff: {job.trigger}
            </p>
          ) : null}
          {job.steps.length === 0 && !job.error ? (
            <p className="text-xs text-muted-foreground">
              No tool calls recorded — the run never reached the model.
            </p>
          ) : null}
          {job.steps.map((step, i) => (
            <div key={i} className="rounded-md bg-muted/60 p-2">
              <code className="text-xs font-semibold">{step.tool}()</code>
              <pre className="mt-1 overflow-x-auto text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                {truncate(JSON.stringify(step.output, null, 2))}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function truncate(text = "", max = 400) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
