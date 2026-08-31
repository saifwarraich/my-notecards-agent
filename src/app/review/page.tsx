import type { Metadata } from "next";
import { ReviewDeck } from "@/components/review-deck";

export const metadata: Metadata = { title: "Review · Notecards" };

export default function ReviewPage() {
  return <ReviewDeck />;
}
