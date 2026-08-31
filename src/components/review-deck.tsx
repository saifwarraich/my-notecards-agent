"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { pageFetcher, useInfiniteList } from "@/lib/use-infinite";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/lib/types";

type Deck = {
  id: string;
  title: string;
  cardCount: number;
  cards: Flashcard[];
};

const DECKS_PER_PAGE = 4;

/** One deck per note. More decks load as the page scrolls. */
export function ReviewDeck() {
  const fetchPage = useMemo(
    () => pageFetcher<Deck>("/api/decks", "decks", DECKS_PER_PAGE),
    [],
  );
  const { items: decks, hasMore, loading, ready, sentinel, setItems } =
    useInfiniteList<Deck>(fetchPage);

  // Cards live here now, so this is where a bad one gets thrown away.
  const removeCard = useCallback(
    async (noteId: string, cardId: string) => {
      await api(`/api/flashcards?id=${cardId}`, { method: "DELETE" });
      setItems((current) =>
        current.map((deck) =>
          deck.id === noteId
            ? {
                ...deck,
                cardCount: deck.cardCount - 1,
                cards: deck.cards.filter((c) => c.id !== cardId),
              }
            : deck,
        ),
      );
    },
    [setItems],
  );

  if (!ready) {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (decks.length === 0) {
    return (
      <p className="mt-8 text-center text-muted-foreground">
        No cards yet. Write a note and save it.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="grid gap-6 sm:grid-cols-2">
        {decks.map((deck) => (
          <DeckStack key={deck.id} deck={deck} onRemove={removeCard} />
        ))}
      </div>

      <div ref={sentinel} className="flex justify-center py-6">
        {loading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : hasMore ? null : (
          <span className="text-xs text-muted-foreground">
            That&apos;s everything.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A deck: one card face-up on a visible stack. Click to reveal the answer,
 * arrows to move through the pile.
 */
function DeckStack({
  deck,
  onRemove,
}: {
  deck: Deck;
  onRemove: (noteId: string, cardId: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const card = deck.cards[index];
  const total = deck.cards.length;

  function go(delta: number) {
    setRevealed(false);
    setIndex((i) => (i + delta + total) % total);
  }

  function restart() {
    setRevealed(false);
    setIndex(0);
  }

  if (!card) return null;

  async function discard() {
    // Step back if we just removed the last card in the pile.
    if (index >= total - 1) setIndex(Math.max(0, index - 1));
    setRevealed(false);
    await onRemove(deck.id, card.id).catch(() => {
      // api() already showed the toast.
    });
  }

  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="truncate font-heading">{deck.title || "Untitled"}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {index + 1} / {total}
        </span>
      </div>

      {/* The pile: two stubs peeking out behind the live card. */}
      <div className="relative">
        {total > 2 ? <StackLayer offset={8} /> : null}
        {total > 1 ? <StackLayer offset={4} /> : null}

        <Card
          onClick={() => setRevealed((r) => !r)}
          className="relative flex min-h-48 cursor-pointer flex-col justify-center gap-3 p-5 transition-colors hover:bg-accent/40"
        >
          <p className="font-medium">{card.front}</p>
          {revealed ? (
            <p className="border-t pt-3 text-sm text-muted-foreground">
              {card.back}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/60">click to reveal</p>
          )}
        </Card>
      </div>

      <div className="mt-3 flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => go(-1)}
          disabled={total < 2}
          aria-label="Previous card"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => go(1)}
          disabled={total < 2}
          aria-label="Next card"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={restart}
          disabled={index === 0 && !revealed}
          aria-label="Back to the first card"
          className="ml-auto"
        >
          <RotateCcw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={discard}
          aria-label="Delete this card"
        >
          <X className="text-destructive" />
        </Button>
      </div>
    </section>
  );
}

/** A sliver of the cards underneath, so the deck reads as a pile. */
function StackLayer({ offset }: { offset: number }) {
  return (
    <div
      aria-hidden
      style={{ top: offset, left: offset, right: -offset }}
      className={cn(
        "absolute bottom-0 rounded-xl border bg-card",
        "shadow-xs",
      )}
    />
  );
}
