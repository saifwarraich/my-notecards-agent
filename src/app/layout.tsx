import type { Metadata, Viewport } from "next";
import { Patrick_Hand } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/register-sw";
import { SiteHeader } from "@/components/site-header";
import { NotesProvider } from "@/components/notes-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const fontSans = Patrick_Hand({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-patrick-hand",
});

export const metadata: Metadata = {
  title: "Notecards",
  description: "Notes that turn themselves into flashcards.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Notecards", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f7" },
    { media: "(prefers-color-scheme: dark)", color: "#333333" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class on <html> before paint, which React would
    // otherwise flag as a hydration mismatch.
    <html
      lang="en"
      className={`${fontSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* The shell is exactly one viewport tall and never scrolls itself.
          Each page decides which of its own regions scroll. */}
      <body className="flex h-dvh flex-col overflow-hidden">
        <ThemeProvider>
          <NotesProvider>
            <main className="mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col px-4 pt-4">
              <SiteHeader />
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </main>
          </NotesProvider>
          <Toaster />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
