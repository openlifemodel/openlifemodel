import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { bundledModels } from "@/lib/models";
import { REPO_URL } from "@/lib/site";

const POINTS = [
  {
    title: "Evidence you can check",
    body: "Every number links to the study it came from: smoking, weight and exercise from studies of millions of people.",
    icon: "M9 12l2 2 4-4M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7l7-4z",
  },
  {
    title: "Private by design",
    body: "The calculation runs in your browser. This site never sends what you type to a server, and there are no accounts or cookies.",
    icon: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
  },
  {
    title: "Open models",
    body: "Change any assumption and watch the result move. Export your version, or import someone else's.",
    icon: "M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12",
  },
];

const STEPS = [
  ["Start from national data", "US death rates by age and sex from the Social Security Administration's life table."],
  ["Adjust for your habits", "Published hazard ratios scale that risk up or down, rescaled so an average person matches the national figure."],
  ["Draw your survival curve", "Your chance of being alive at each age; life expectancy is the area under the curve."],
] as const;

export default function Home() {
  const models = bundledModels().map((m) => m.model);
  return (
    <>
      <section className="mb-10 max-w-3xl sm:mb-12">
        <div className="pill mb-5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          Open source · Runs in your browser · Experimental
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          The life expectancy calculator that <span className="text-accent">shows its work</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
          Answer a few questions to see your estimated survival curve. Then open the model behind it: every
          assumption, every source, and every number you can change.
        </p>
      </section>

      <Calculator models={models} />

      <section className="mt-16 grid gap-4 sm:grid-cols-3" aria-label="Why OpenLifeModel">
        {POINTS.map((p) => (
          <div key={p.title} className="card p-5">
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={p.icon} />
              </svg>
            </div>
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">How the estimate is made</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-muted">
          Read the full method on <Link href="/about/" className="font-medium text-accent-strong underline underline-offset-4">How it works</Link>,
          or the exact formulas in the{" "}
          <a href={`${REPO_URL}/blob/main/spec/OLM-SPEC.md`} className="font-medium text-accent-strong underline underline-offset-4">
            OLM specification
          </a>
          .
        </p>
      </section>
    </>
  );
}
