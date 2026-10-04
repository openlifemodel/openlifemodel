"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * While the model editor is open, keeps the key result in view once the
 * results card has scrolled off screen, so every edit shows its effect.
 */
export function SummaryBar({
  watch,
  ageAtDeath,
  age,
  equivalentAge,
  original,
  stale,
}: {
  watch: RefObject<HTMLElement | null>;
  ageAtDeath: number;
  age: number;
  equivalentAge: number;
  original: number | null;
  stale: boolean;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = watch.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!(entry?.isIntersecting ?? true)), {
      rootMargin: "-56px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [watch]);

  if (!visible) return null;
  const diff = original === null ? null : ageAtDeath - original;
  const equivalent = age >= 18 && equivalentAge < 18 ? "<18" : String(Math.round(equivalentAge));
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-14 z-30 border-b border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-sm">
        <span>
          <span className="text-muted">Estimated age at death </span>
          <strong className="tabular-nums">{ageAtDeath.toFixed(1)}</strong>
        </span>
        <span>
          <span className="text-muted">Equivalent age </span>
          <strong className="tabular-nums">{equivalent}</strong>
        </span>
        {diff !== null && Math.abs(diff) >= 0.05 && (
          <span className={diff > 0 ? "text-good" : "text-bad"}>
            {diff > 0 ? "+" : "−"}
            {Math.abs(diff).toFixed(1)} y vs original model
          </span>
        )}
        {stale && <span className="text-bad">Showing the last valid version</span>}
      </div>
    </div>
  );
}
