import type { Metadata } from "next";
import { ReviewDeck } from "@/components/review-deck";

export const metadata: Metadata = { title: "Review · Notecards" };

export default function ReviewPage() {
  // The shell no longer scrolls, so this page owns its scrolling — which is
  // also what the infinite-scroll sentinel rides on.
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <ReviewDeck />
    </div>
  );
}
