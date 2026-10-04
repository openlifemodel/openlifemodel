"use client";

import { useMemo, useState } from "react";
import { calculate, type OlmModel } from "@openlifemodel/engine";
import { parseLifeTable, type TableKey } from "@/lib/draft-model";
import type { LibraryTable } from "@/lib/life-tables";
import { NumberField, RemoveButton, SectionIntro, SelectField, TextField } from "./Fields";

type Edit = (change: (model: OlmModel) => void) => void;

const TABLE_NAMES: Record<TableKey, string> = { male: "Men", female: "Women", all: "Both sexes combined" };
const TABLE_COLOURS: Record<TableKey, string> = { male: "var(--accent)", female: "var(--bad)", all: "var(--chart-base)" };
const keysOf = (qx: OlmModel["baseline"]["qx"]) => (["male", "female", "all"] as const).filter((k) => qx[k]);

export function LifeTableTab({ model, edit, library }: { model: OlmModel; edit: Edit; library: LibraryTable[] }) {
  const baseline = model.baseline;
  const keys = keysOf(baseline.qx);
  const lastAge = baseline.start_age + (baseline.qx[keys[0] ?? "all"]?.length ?? 1) - 1;
  const source = model.sources.find((s) => s.id === baseline.source);
  const normalized = model.adjustment !== undefined && model.adjustment.normalization !== "none";

  const [pick, setPick] = useState(library[0]?.id ?? "");
  const [pasted, setPasted] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const parsed = pasted.trim() ? parseLifeTable(pasted) : null;

  // Life expectancy at the table's first age, a quick sanity check on the numbers.
  const expectancies = useMemo(() => {
    const { adjustment: _factors, inputs: _questions, ...tableOnly } = model;
    return keys.map((k) => {
      try {
        const profile = { age: baseline.start_age, ...(k !== "all" && { sex: k }) };
        return [k, calculate(tableOnly, profile).remaining_life_expectancy] as const;
      } catch {
        return [k, null] as const;
      }
    });
  }, [model, keys, baseline.start_age]);

  const sharesWarning = (newRegion: string | undefined) =>
    normalized && newRegion !== baseline.region
      ? `The new table is for ${newRegion ?? "an unstated population"}, but this model's population shares were set for ${
          baseline.region ?? "the previous table's population"
        }. Check the shares on the Risk factors tab describe the new population.`
      : null;

  const useLibraryTable = () => {
    const table = library.find((t) => t.id === pick);
    if (!table) return;
    const warning = sharesWarning(table.region);
    edit((m) => {
      m.baseline = structuredClone(table.baseline);
      const existing = m.sources.findIndex((s) => s.id === table.source.id);
      if (existing === -1) m.sources.push(structuredClone(table.source));
      else m.sources[existing] = structuredClone(table.source);
    });
    setNotice(warning ?? `Now using ${table.name}.`);
  };

  const usePasted = () => {
    if (!parsed?.ok) return;
    edit((m) => {
      m.baseline = { ...m.baseline, start_age: parsed.startAge, qx: parsed.qx };
    });
    setPasted("");
    setNotice(
      normalized
        ? "Table replaced. Update the life table's source and region below, and check the population shares on the Risk factors tab describe this population."
        : "Table replaced. Update its source and region below.",
    );
  };

  return (
    <div className="space-y-8">
      <SectionIntro>
        The life table gives the chance of dying within a year at each age for the whole population. Risk factors then
        scale it up or down for each person. Life tables are usually updated every year or two, so you can swap in a newer
        one without touching the risk factors.
      </SectionIntro>

      {notice && (
        <p role="status" className="rounded-lg bg-accent-soft p-3 text-sm">
          {notice}
        </p>
      )}

      <section className="rounded-xl border border-line p-4 sm:p-5">
        <h3 className="font-semibold">Current table</h3>
        <p className="mt-1 text-sm text-muted">
          {source?.citation ?? "No source"} · ages {baseline.start_age}–{lastAge} ·{" "}
          {keys.map((k) => TABLE_NAMES[k].toLowerCase()).join(", ")}
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {expectancies.map(([k, e]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-muted">
                {TABLE_NAMES[k]}, life expectancy at {baseline.start_age}:
              </dt>
              <dd className="font-semibold tabular-nums">{e === null ? "n/a" : e.toFixed(1)}</dd>
            </div>
          ))}
        </dl>
        <TableChart qx={baseline.qx} startAge={baseline.start_age} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Source of this table"
            value={baseline.source}
            options={model.sources.map((s) => ({ value: s.id, label: s.citation.slice(0, 70) || s.id }))}
            onChange={(v) => edit((m) => void (m.baseline.source = v))}
            hint="Add a new source on the Sources tab first if needed."
          />
          <TextField
            label="Region (country code)"
            mono
            value={baseline.region ?? ""}
            maxLength={2}
            placeholder="e.g. US, GB, DE"
            onChange={(v) =>
              edit((m) => {
                const code = v.toUpperCase().replace(/[^A-Z]/g, "");
                if (code === "") delete m.baseline.region;
                else m.baseline.region = code;
              })
            }
          />
        </div>
      </section>

      {library.length > 0 && (
        <section>
          <h3 className="mb-2 font-semibold">Use a table from the library</h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1">
              <SelectField
                label="Table"
                value={pick}
                options={library.map((t) => ({ value: t.id, label: `${t.name}${t.region ? ` (${t.region})` : ""}` }))}
                onChange={setPick}
              />
            </div>
            <button type="button" className="btn" onClick={useLibraryTable}>
              Use this table
            </button>
          </div>
          <p className="hint">The table is copied into your model, so the file stays complete and its results never change.</p>
        </section>
      )}

      <section>
        <h3 className="mb-1 font-semibold">Paste your own table</h3>
        <p className="mb-2 text-sm text-muted">
          Copy columns from a spreadsheet: age, then the probability of dying within the year. Add a header row naming
          the columns <code className="font-mono text-xs">male</code>, <code className="font-mono text-xs">female</code>{" "}
          or <code className="font-mono text-xs">all</code>.
        </p>
        <textarea
          className="field !h-36 py-2 font-mono text-xs"
          aria-label="Pasted life table"
          placeholder={"age\tmale\tfemale\n0\t0.006015\t0.005125\n1\t0.000479\t0.000392\n…"}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
        />
        {parsed && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {parsed.ok ? (
              <>
                <span className="text-good">
                  Read ages {parsed.startAge}–{parsed.startAge + (Object.values(parsed.qx)[0]?.length ?? 1) - 1} for{" "}
                  {keysOf(parsed.qx).map((k) => TABLE_NAMES[k].toLowerCase()).join(", ")}.
                </span>
                <button type="button" className="btn btn-primary" onClick={usePasted}>
                  Replace the life table
                </button>
              </>
            ) : (
              <span className="text-bad">{parsed.error}</span>
            )}
          </div>
        )}
      </section>

      <details>
        <summary className="cursor-pointer font-semibold">Edit individual values</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {keys.length > 1 &&
            keys.map((k) => (
              <span key={k} className="inline-flex items-center gap-1 text-sm text-muted">
                Remove the {TABLE_NAMES[k].toLowerCase()} table
                <RemoveButton
                  label={`Remove the ${TABLE_NAMES[k].toLowerCase()} table`}
                  onClick={() => edit((m) => void delete m.baseline.qx[k])}
                />
              </span>
            ))}
        </div>
        <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted">Age</th>
                {keys.map((k) => (
                  <th key={k} className="px-3 py-2 text-left text-xs font-medium text-muted">
                    {TABLE_NAMES[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(baseline.qx[keys[0] ?? "all"] ?? []).map((_, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1 tabular-nums text-muted">{baseline.start_age + i}</td>
                  {keys.map((k) => (
                    <td key={k} className="px-3 py-1">
                      <NumberField
                        compact
                        ariaLabel={`${TABLE_NAMES[k]}, age ${baseline.start_age + i}: probability of dying`}
                        value={baseline.qx[k]?.[i]}
                        onChange={(v) => v !== undefined && edit((m) => void (m.baseline.qx[k]![i] = v))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Death probability by age on a log scale: a smooth rising line, so typos show up as spikes. */
function TableChart({ qx, startAge }: { qx: OlmModel["baseline"]["qx"]; startAge: number }) {
  const W = 640;
  const H = 180;
  const PAD = { top: 10, right: 10, bottom: 24, left: 44 };
  const keys = keysOf(qx);
  const length = qx[keys[0] ?? "all"]?.length ?? 0;
  if (length < 2) return null;
  const lo = -5;
  const hi = 0;
  const x = (i: number) => PAD.left + (i / (length - 1)) * (W - PAD.left - PAD.right);
  const y = (q: number) => PAD.top + (1 - (Math.log10(Math.max(q, 1e-5)) - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const decades: number[] = [];
  for (let a = Math.ceil(startAge / 20) * 20; a <= startAge + length - 1; a += 20) decades.push(a);
  return (
    <div className="mt-3 max-w-2xl">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Probability of dying within a year, by age, on a log scale">
        {[-4, -3, -2, -1, 0].map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(10 ** p)} y2={y(10 ** p)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={PAD.left - 6} y={y(10 ** p) + 4} textAnchor="end" fontSize="10" fill="var(--faint)">
              {p === 0 ? "100%" : `${10 ** (p + 2)}%`}
            </text>
          </g>
        ))}
        {decades.map((a) => (
          <text key={a} x={x(a - startAge)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">
            {a}
          </text>
        ))}
        {keys.map((k) => (
          <path
            key={k}
            d={(qx[k] ?? []).map((q, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(q).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={TABLE_COLOURS[k]}
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex gap-4 text-xs text-muted">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: TABLE_COLOURS[k] }} /> {TABLE_NAMES[k]}
          </span>
        ))}
        <span className="ml-auto">Yearly chance of dying, log scale</span>
      </div>
    </div>
  );
}
