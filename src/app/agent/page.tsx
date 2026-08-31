import type { Metadata } from "next";
import { ActivityFeed } from "@/components/activity-feed";

export const metadata: Metadata = { title: "Agent · Notecards" };

export default function AgentPage() {
  return <ActivityFeed />;
}
