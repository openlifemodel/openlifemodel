import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ContactEmail } from "@/components/ContactEmail";
import { EARLY_ACCESS_ENABLED } from "@/components/EarlyAccess";
import { ThemeToggle, themeScript } from "@/components/ThemeToggle";
import { REPO_URL, SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Open-source life expectancy calculator | OpenLifeModel",
    template: "%s | OpenLifeModel",
  },
  description:
    "Estimate life expectancy with open, inspectable survival models. Change the assumptions, compare models and export them as open model files. Runs entirely in your browser.",
  alternates: { canonical: "/" },
  openGraph: { siteName: "OpenLifeModel", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1c" },
  ],
};

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#0d9488" />
      <path d="M12 18 C 26 18, 31 20, 36 31 S 44 46, 52 46 L 52 50 L 12 50 Z" fill="#ffffff" fillOpacity="0.24" />
      <path d="M12 18 C 26 18, 31 20, 36 31 S 44 46, 52 46" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="36" cy="31" r="5" fill="#ffffff" />
    </svg>
  );
}

const navLink = "whitespace-nowrap rounded-lg px-1.5 py-1.5 text-muted transition hover:bg-surface-2 hover:text-fg sm:px-2.5";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur-md">
          <nav className="mx-auto flex h-14 max-w-6xl items-center gap-0.5 px-4 text-sm sm:gap-2">
            <Link href="/" className="mr-1 flex shrink-0 items-center gap-2 font-semibold tracking-tight sm:mr-4">
              <Logo />
              <span className="hidden sm:inline">OpenLifeModel</span>
            </Link>
            <Link href="/models/" className={`${navLink} max-[359px]:hidden`}>
              Models
            </Link>
            <Link href="/about/" className={navLink}>
              How it works
            </Link>
            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              {EARLY_ACCESS_ENABLED && (
                <Link href="/early-access/" className="whitespace-nowrap rounded-lg px-1.5 py-1.5 font-medium text-accent-strong transition hover:bg-accent-soft sm:px-2.5">
                  Early access
                </Link>
              )}
              <a href={REPO_URL} className={`${navLink} hidden items-center gap-1.5 sm:flex`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                GitHub
              </a>
              <ThemeToggle />
            </div>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:pt-12">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <div className="mb-3 flex items-center gap-2 font-semibold text-fg">
                <Logo /> OpenLifeModel
              </div>
              <p className="max-w-md leading-relaxed">
                Experimental. Results are educational statistical estimates, not medical advice or a
                prediction of any individual&apos;s lifespan. This site never sends your answers to a server.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-fg">Explore</div>
              <Link href="/models/" className="block hover:text-fg">
                Models
              </Link>
              <Link href="/about/" className="block hover:text-fg">
                How it works
              </Link>
              <a href={`${REPO_URL}/blob/main/spec/OLM-SPEC.md`} className="block hover:text-fg">
                OLM specification
              </a>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-fg">Project</div>
              <a href={REPO_URL} className="block hover:text-fg">
                Source code (Apache-2.0)
              </a>
              <Link href="/privacy/" className="block hover:text-fg">
                Privacy
              </Link>
              <ContactEmail className="block hover:text-fg" />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
