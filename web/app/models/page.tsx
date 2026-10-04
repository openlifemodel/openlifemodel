import type { Metadata } from "next";
import Link from "next/link";
import { bundledModels } from "@/lib/models";

export const metadata: Metadata = {
  title: "Models",
  description: "Open life expectancy models in the .olm format, with their sources, assumptions and reference tests.",
  alternates: { canonical: "/models/" },
};

export default function ModelsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Models</h1>
      <p className="mt-2 muted">
        Each model is a single <code>.olm</code> file: a baseline life table, the personal factors that adjust it,
        where every number came from, and test cases that any implementation must reproduce.
      </p>
      <ul className="mt-6 space-y-4">
        {bundledModels().map(({ model }) => (
          <li key={model.id} className="card p-5">
            <h2 className="font-semibold">
              <Link href={`/models/${model.id}/`} className="hover:underline">
                {model.name}
              </Link>
            </h2>
            <p className="mt-1 text-xs muted">
              v{model.version} · {model.status} · {model.license}
            </p>
            <p className="mt-2 text-sm">{model.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
