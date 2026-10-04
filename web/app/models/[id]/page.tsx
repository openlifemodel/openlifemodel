import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Factor, OlmModel } from "@openlifemodel/engine";
import { bundledModel, bundledModels } from "@/lib/models";
import { levelLabel } from "@/lib/labels";
import { REPO_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return bundledModels().map(({ model }) => ({ id: model.id }));
}

export async function generateMetadata({ params }: PageProps<"/models/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = bundledModel(id);
  return found
    ? { title: found.model.name, description: found.model.description, alternates: { canonical: `/models/${id}/` } }
    : {};
}

const STATUS_TEXT = {
  illustrative: "Illustrative: demonstrates the format. The numbers are not evidence-based.",
  experimental: "Experimental: based on published evidence but not validated as a whole.",
  published: "Published: reproduces an authoritative published source.",
} as const;

function levelRows(model: OlmModel, factor: Factor) {
  return factor.type === "categorical"
    ? factor.levels.map((l) => [levelLabel(model, factor, l.value), l.hazard_ratio, l.prevalence] as const)
    : factor.bands.map(
        (b) =>
          [
            b.min === undefined ? `< ${b.max}` : b.max === undefined ? `≥ ${b.min}` : `${b.min} to < ${b.max}`,
            b.hazard_ratio,
            b.prevalence,
          ] as const,
      );
}

export default async function ModelPage({ params }: PageProps<"/models/[id]">) {
  const { id } = await params;
  const found = bundledModel(id);
  if (!found) notFound();
  const { model, file } = found;
  const sources = new Map(model.sources.map((s) => [s.id, s]));

  return (
    <article className="prose-olm max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">{model.name}</h1>
      <p className="text-sm text-muted">
        Version {model.version} · Licence {model.license} · By {model.authors.map((a) => a.name).join(", ")}
      </p>
      <p className={`rounded-lg p-3 text-sm ${model.status === "illustrative" ? "bg-bad-soft text-bad" : "bg-accent-soft"}`}>
        {STATUS_TEXT[model.status]}
      </p>
      <p>{model.description}</p>
      <p>
        <a href={`/olm/${file}`} download>
          Download {file}
        </a>{" "}
        · <a href={`${REPO_URL}/blob/main/models/${file}`}>View on GitHub</a>
      </p>

      {model.population && (
        <>
          <h2>Intended population</h2>
          <p>{model.population}</p>
        </>
      )}

      {model.assumptions && (
        <>
          <h2>Assumptions</h2>
          <ul>
            {model.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}

      {model.inputs && model.inputs.length > 0 && (
        <>
          <h2>Questions this model asks</h2>
          <p>In addition to the standard profile questions, this model declares its own inputs:</p>
          <ul>
            {model.inputs.map((i) => (
              <li key={i.id}>
                <strong>{i.question ?? i.label}</strong>{" "}
                {i.type === "number"
                  ? `(${i.min}–${i.max} ${i.unit ?? ""})`
                  : `(${(i.choices ?? []).map((c) => c.label).join(", ")})`}
                {i.help && <> {i.help}</>}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Baseline</h2>
      <p>
        Period life table from age {model.baseline.start_age}, for{" "}
        {Object.keys(model.baseline.qx).join(" and ")}. Source: {sources.get(model.baseline.source)?.citation}
      </p>

      {model.adjustment && (
        <>
          <h2>Personal factors</h2>
          <p>
            Method: proportional hazards
            {model.adjustment.normalization === "population-average"
              ? ", rescaled so that population-average exposure reproduces the baseline."
              : ", applied to the baseline as written."}
          </p>
          {model.adjustment.factors.map((factor) => (
            <div key={factor.id} className="card mb-4 p-5">
              <h3 className="font-semibold">{factor.label}</h3>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 font-normal">Level</th>
                    <th className="py-1 font-normal">Hazard ratio</th>
                    <th className="py-1 font-normal">Population share</th>
                  </tr>
                </thead>
                <tbody>
                  {levelRows(model, factor).map(([label, hr, prevalence]) => (
                    <tr key={label} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-1">{label}</td>
                      <td className="py-1 tabular-nums">{hr}</td>
                      <td className="py-1 tabular-nums">{prevalence ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {factor.source && <p className="mt-1 text-xs text-muted">Source: {sources.get(factor.source)?.citation}</p>}
            </div>
          ))}
        </>
      )}

      <h2>Sources</h2>
      <ul>
        {model.sources.map((s) => (
          <li key={s.id}>
            {s.citation}
            {s.doi && (
              <>
                {" "}
                <a href={`https://doi.org/${s.doi}`}>doi:{s.doi}</a>
              </>
            )}
            {s.url && (
              <>
                {" "}
                <a href={s.url}>{s.url}</a>
              </>
            )}
          </li>
        ))}
      </ul>

      {model.tests && (
        <>
          <h2>Reference tests</h2>
          <p>
            {model.tests.length} test case{model.tests.length === 1 ? "" : "s"} that any OLM implementation must
            reproduce. They run on every change to the code.
          </p>
        </>
      )}
    </article>
  );
}
