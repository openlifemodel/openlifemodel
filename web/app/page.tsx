import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { bundledModels } from "@/lib/models";

export default function Home() {
  const models = bundledModels().map((m) => m.model);
  return (
    <>
      <section className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          The life expectancy calculator that shows its work
        </h1>
        <p className="mt-3 text-lg muted">
          Enter a few facts about yourself and see your estimated survival curve. Every number
          behind it is open: inspect the model, change its assumptions, compare models, and export
          your version as an open model file.
        </p>
        <p className="mt-2 text-sm muted">
          Runs entirely in your browser · <Link href="/about/" className="underline">How it works</Link>
        </p>
      </section>
      <Calculator models={models} />
    </>
  );
}
