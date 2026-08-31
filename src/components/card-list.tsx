"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { Flashcard } from "@/lib/types";

export function CardList({
  cards,
  onDeleted,
}: {
  cards: Flashcard[];
  onDeleted: (id: string) => void;
}) {
  if (cards.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        No cards yet. Save a note with something worth learning in it.
      </p>
    );
  }

  return (
    <div className="grid gap-2 p-4 sm:grid-cols-2">
      {cards.map((card) => (
        <FlipCard key={card.id} card={card} onDeleted={onDeleted} />
      ))}
    </div>
  );
}

function FlipCard({
  card,
  onDeleted,
}: {
  card: Flashcard;
  onDeleted: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    await api(`/api/flashcards?id=${card.id}`, { method: "DELETE" });
    onDeleted(card.id);
  }

  return (
    <Card
      onClick={() => setRevealed((r) => !r)}
      className="group relative cursor-pointer gap-2 p-3 transition-colors hover:bg-accent/40"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={remove}
        className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </Button>
      <p className="pr-6 text-sm font-medium">{card.front}</p>
      {revealed ? (
        <p className="text-sm text-muted-foreground">{card.back}</p>
      ) : (
        <p className="text-xs text-muted-foreground/60">click to reveal</p>
      )}
    </Card>
  );
}
