"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFetch } from "@/lib/use-fetch";
import { JobTrace } from "./job-trace";
import type { Job } from "@/lib/types";

/** Every agent run, newest first — the "show me it's real" screen. */
export function ActivityFeed() {
  const { data: jobs, reload } = useFetch<Job[]>("/api/jobs");

  if (!jobs) return <Skeleton className="mt-4 h-64 w-full" />;

  return (
    <div className="mt-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="font-heading">Agent runs</h2>
        <Button onClick={reload} variant="ghost" size="icon-sm">
          <RefreshCw />
        </Button>
      </div>

      {jobs.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No runs yet. Saving a note with new material triggers one.
        </p>
      ) : (
        jobs.map((job) => (
          <div key={job.id}>
            <p className="px-4 pt-3 text-xs text-muted-foreground">
              {job.noteTitle} · {new Date(job.createdAt).toLocaleString()}
            </p>
            <JobTrace job={job} />
          </div>
        ))
      )}
    </div>
  );
}
