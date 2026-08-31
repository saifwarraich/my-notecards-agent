import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity-feed";

export const metadata: Metadata = { title: "Agent · Notecards" };

export default function AgentPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <ActivityFeed />
    </div>
  );
}
