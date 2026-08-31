"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ModeToggle } from "./mode-toggle";

const NAV = [
  { href: "/", label: "Notes" },
  { href: "/review", label: "Review" },
  { href: "/agent", label: "Agent" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="mb-4">
      <div className="flex items-baseline gap-3">
        <Link href="/" className="font-heading text-2xl">
          Notecards
        </Link>
        <p className="hidden text-sm text-muted-foreground sm:block">
          Write notes. Save. An agent reads the diff and writes your flashcards.
        </p>
      </div>

      <nav className="mt-3 flex items-center gap-1">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // Prefetch keeps switching tabs instant even though each one is
              // now a real page rather than a hidden panel.
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
