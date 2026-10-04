import type { Metadata } from "next";
import Link from "next/link";
import { bundledModels } from "@/lib/models";

export const metadata: Metadata = {
  title: "Models",
  description: "Open life expectancy models in the open OLM format, with their sources, assumptions and reference tests.",
  alternates: { canonical: "/models/" },
};

export default function ModelsPage() {
  return (
    <div className="max-w-3xl">
      <p className="pill mb-4">Open models</p>
      <h1 className="text-3xl font-semibold tracking-tight">Models</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Each model is a single OLM file (<code>.olm.yaml</code>): a baseline life table, the personal factors that adjust it,
        where every number came from, and test cases that any implementation must reproduce.
      </p>
      <ul className="mt-6 space-y-4">
        {bundledModels().map(({ model }) => (
          <li key={model.id} className="card p-5 transition hover:border-accent">
            <h2 className="text-lg font-semibold">
              <Link href={`/models/${model.id}/`} className="hover:underline">
                {model.name}
              </Link>
            </h2>
            <p className="mt-1 text-xs text-muted">
              v{model.version} · {model.status} · {model.license}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{model.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
