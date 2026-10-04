import type { Metadata } from "next";
import Link from "next/link";
import { REPO_URL, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OpenLifeModel: open, transparent life expectancy models",
    template: "%s · OpenLifeModel",
  },
  description:
    "Estimate life expectancy with open, inspectable survival models. Change the assumptions, compare models and export them as .olm files. Runs entirely in your browser.",
  alternates: { canonical: "/" },
  openGraph: { siteName: "OpenLifeModel", type: "website" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b" style={{ borderColor: "var(--border)" }}>
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
            <Link href="/" className="text-base font-semibold">
              OpenLifeModel
            </Link>
            <Link href="/models/" className="muted hover:underline">
              Models
            </Link>
            <Link href="/about/" className="muted hover:underline">
              How it works
            </Link>
            <a href={REPO_URL} className="muted ml-auto hover:underline">
              GitHub
            </a>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs muted">
          <p>
            Experimental. Results are educational statistical estimates, not medical advice or a
            prediction of any individual&apos;s lifespan. Your inputs never leave your browser.
          </p>
          <p className="mt-2">
            Code under Apache-2.0 on <a href={REPO_URL} className="underline">GitHub</a> ·{" "}
            <a href="mailto:info@openlifemodel.com" className="underline">
              info@openlifemodel.com
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
