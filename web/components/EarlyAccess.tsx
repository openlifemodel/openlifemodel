"use client";

import { useEffect, useId, useState } from "react";

/**
 * Early-access sign-up for openlifemodel.com. It posts to a Cloudflare Pages
 * Function (functions/api/early-access.ts) and only appears in builds made with
 * NEXT_PUBLIC_EARLY_ACCESS=1, so self-hosted copies don't show it.
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

export function EarlyAccess({ variant = "card" }: { variant?: "card" | "page" }) {
  const [email, setEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const id = useId();

  useEffect(() => {
    visitSource(); // remember the landing source before people navigate around
  }, []);

  if (!EARLY_ACCESS_ENABLED) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, interests, website, source: visitSource() }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("error");
    }
  };

  const heading = (
    <>
      <p className="pill mb-3">Early access</p>
      <h2 className={variant === "page" ? "text-3xl font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>
        Save your history and watch it change
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        Accounts are coming: track your estimate over time, add lab results and connect wearables. Join the early-access
        list and we&apos;ll email you when it opens. One email, no spam, unsubscribe any time.
      </p>
    </>
  );

  if (state === "done") {
    return (
      <section className={variant === "card" ? "card p-5 sm:p-6" : ""} aria-live="polite">
        <p className="pill mb-3">Early access</p>
        <h2 className="text-xl font-semibold tracking-tight">You&apos;re on the list</h2>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll email <strong className="text-fg">{email}</strong> when accounts open. Thanks for helping shape
          what we build first.
        </p>
      </section>
    );
  }

  return (
    <section className={variant === "card" ? "card p-5 sm:p-6" : ""} aria-labelledby={`${id}-title`}>
      <div id={`${id}-title`}>{heading}</div>
      <form className="mt-5 space-y-5" onSubmit={submit}>
        <fieldset>
          <legend className="label">What would you use it for? (optional, tick any)</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTERESTS.map((option) => (
              <label key={option.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  checked={interests.includes(option.id)}
                  onChange={(e) =>
                    setInterests((list) => (e.target.checked ? [...list, option.id] : list.filter((i) => i !== option.id)))
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        {/* Hidden from people; bots tend to fill it in. */}
        <label className="hidden" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <label className="min-w-0 flex-1 basis-64">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary !h-10" disabled={state === "sending"}>
            {state === "sending" ? "Joining…" : "Join early access"}
          </button>
        </div>
        {state === "error" && (
          <p role="alert" className="text-sm text-bad">
            {error}
          </p>
        )}
        <p className="text-xs text-faint">
          We only use your email to tell you when accounts open. Your calculator answers are never sent with it. See{" "}
          <a href="/privacy/#early-access" className="underline underline-offset-2">
            privacy
          </a>
          .
        </p>
      </form>
    </section>
  );
}
