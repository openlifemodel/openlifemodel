"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Early-access sign-up for openlifemodel.com. It posts to Cloudflare Pages
 * Functions (functions/api/early-access*.ts) and only appears in builds made
 * with NEXT_PUBLIC_EARLY_ACCESS=1, so self-hosted copies don't show it.
 */
export const EARLY_ACCESS_ENABLED = process.env.NEXT_PUBLIC_EARLY_ACCESS === "1";

// Keep in step with functions/api/early-access.ts.
const INTERESTS = [
  { id: "history", label: "Tracking my estimate over time" },
  { id: "labs", label: "Adding lab results (cholesterol, HbA1c…)" },
  { id: "wearables", label: "Connecting wearables (Garmin, Apple, Oura…)" },
  { id: "assistant", label: "Logging things through an AI assistant" },
  { id: "models", label: "Building and sharing my own models" },
] as const;

const PITCH = "Accounts are coming: track your estimate over time, add lab results and connect wearables.";
const SOURCE_KEY = "olm.source";

/** Where this visitor came from: ?ref=… on the landing URL, else the referring site. Kept for this visit only. */
function visitSource(): string | null {
  try {
    const saved = sessionStorage.getItem(SOURCE_KEY);
    if (saved) return saved;
    const ref = new URLSearchParams(window.location.search).get("ref");
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    const source = (ref || (host && host !== window.location.hostname ? host : "") || "").toLowerCase().slice(0, 60);
    if (source) sessionStorage.setItem(SOURCE_KEY, source);
    return source || null;
  } catch {
    return null;
  }
}

async function post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Please try again.");
  return data;
}

/** A slim banner under the calculator that leads to the early-access page. */
export function EarlyAccessBanner() {
  useEffect(() => {
    visitSource(); // remember where the visitor landed from before they navigate
  }, []);
  if (!EARLY_ACCESS_ENABLED) return null;
  return (
    <section className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <h2 className="font-semibold tracking-tight">Save your history and watch it change</h2>
        <p className="mt-1 text-sm text-muted">{PITCH}</p>
      </div>
      <Link href="/early-access/" className="btn btn-primary !h-11 shrink-0 !px-5 !text-sm">
        Join early access
      </Link>
    </section>
  );
}

/** The early-access page: email first, then an optional question on the thank-you screen. */
export function EarlyAccessForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [step, setStep] = useState<"email" | "sending" | "joined" | "saving" | "thanks">("email");
  const [error, setError] = useState("");

  useEffect(() => {
    visitSource();
  }, []);

  if (!EARLY_ACCESS_ENABLED) {
    return <p className="text-muted">Early access is only available on openlifemodel.com.</p>;
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStep("sending");
    try {
      const data = await post("/api/early-access", { email, website, source: visitSource() });
      setToken(typeof data.token === "string" ? data.token : null);
      setStep("joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("email");
    }
  };

  const sendInterests = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("saving");
    try {
      if (token) await post("/api/early-access/interests", { email, token, interests });
    } catch {
      // The answers are a nice-to-have; the sign-up itself has already worked.
    }
    setStep("thanks");
  };

  if (step === "joined" || step === "saving" || step === "thanks") {
    return (
      <div aria-live="polite">
        <h1 className="text-3xl font-semibold tracking-tight">You&apos;re on the list</h1>
        <p className="mt-3 text-muted">
          We&apos;ll email <strong className="text-fg">{email}</strong> when accounts open.
        </p>
        {step === "thanks" ? (
          <p className="mt-8 rounded-xl bg-accent-soft p-4 text-sm">Thanks, that helps us decide what to build first.</p>
        ) : (
          <form className="card mt-8 p-5 sm:p-6" onSubmit={sendInterests}>
            <fieldset>
              <legend className="font-semibold">Help us decide what to build first</legend>
              <p className="mt-1 text-sm text-muted">What would you use it for? Tick any (optional).</p>
              <div className="mt-4 space-y-3">
                {INTERESTS.map((option) => (
                  <label key={option.id} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                      checked={interests.includes(option.id)}
                      onChange={(e) =>
                        setInterests((list) =>
                          e.target.checked ? [...list, option.id] : list.filter((i) => i !== option.id),
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="btn btn-primary mt-5 !h-11 !px-5" disabled={step === "saving" || interests.length === 0}>
              {step === "saving" ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Save your history and watch it change</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted">{PITCH}</p>
      <form className="mt-8 max-w-md" onSubmit={join}>
        <label className="block">
          <span className="label">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="field !h-12 !text-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {/* Hidden from people; bots tend to fill it in. */}
        <label className="hidden" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <button
          type="submit"
          className="btn btn-primary mt-3 !h-12 w-full justify-center !text-base"
          disabled={step === "sending"}
        >
          {step === "sending" ? "Joining…" : "Join early access"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-bad">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-faint">
          We only use your email to tell you when accounts open. See{" "}
          <a href="/privacy/#early-access" className="underline underline-offset-2">
            privacy
          </a>
          .
        </p>
      </form>
    </div>
  );
}
