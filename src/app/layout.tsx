import type { Metadata, Viewport } from "next";
import { Patrick_Hand } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/register-sw";
import { SiteHeader } from "@/components/site-header";
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
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col p-4">
            <SiteHeader />
            {children}
          </main>
          <Toaster />
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
