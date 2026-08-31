"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NoteList } from "./note-list";
import { ModeToggle } from "./mode-toggle";
import { useNotes } from "./notes-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Notes" },
  { href: "/review", label: "Review" },
  { href: "/agent", label: "Agent" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="mb-4 shrink-0">
      <div className="flex items-center gap-2">
        {/* Only the notes page has a sidebar to reveal. */}
        {pathname === "/" ? <NotesDrawer /> : null}

        <Link href="/" className="font-heading text-2xl">
          Notecards
        </Link>
        <p className="hidden text-sm text-muted-foreground lg:block">
          Write notes. Save. An agent reads the diff and writes your flashcards.
        </p>
      </div>

      <nav className="mt-3 flex items-center gap-1">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // Prefetch keeps switching instant even though each tab is a
              // real page rather than a hidden panel.
              prefetch
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                pathname === item.href
                  ? "bg-background shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto">
          <ModeToggle />
        </div>
      </nav>
    </header>
  );
}

function NotesDrawer() {
  const { notes, selected, select, create, drawerOpen, setDrawerOpen } =
    useNotes();

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Show notes"
          className="md:hidden"
        >
          <PanelLeft />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[85vw] flex-col sm:w-80">
        <SheetHeader className="shrink-0">
          <SheetTitle>Notes</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4">
          <Button
            onClick={create}
            size="sm"
            variant="secondary"
            className="shrink-0"
          >
            <Plus /> New note
          </Button>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <NoteList notes={notes} selected={selected} onSelect={select} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
