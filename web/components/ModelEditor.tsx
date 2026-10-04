"use client";

import type { Factor, OlmModel } from "@openlifemodel/engine";

interface Props {
  model: OlmModel;
  onEdit: (next: OlmModel) => void;
}

function bandLabel(min: number | undefined, max: number | undefined): string {
  if (min === undefined) return `below ${max}`;
  if (max === undefined) return `${min} or more`;
  return `${min} to under ${max}`;
}

function rows(factor: Factor) {
  return factor.type === "categorical"
    ? factor.levels.map((l) => ({ label: l.value, hazard_ratio: l.hazard_ratio, prevalence: l.prevalence }))
    : factor.bands.map((b) => ({ label: bandLabel(b.min, b.max), hazard_ratio: b.hazard_ratio, prevalence: b.prevalence }));
}

/** Inline editor for a model's hazard ratios and prevalences. */
export function ModelEditor({ model, onEdit }: Props) {
  const factors = model.adjustment?.factors ?? [];
  if (factors.length === 0) {
    return (
      <p className="text-sm muted">
        This model has no personal factors to edit: it is the baseline life table only.
      </p>
    );
  }

  const update = (fi: number, ri: number, key: "hazard_ratio" | "prevalence", raw: string) => {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value)) return;
    const next = structuredClone(model);
    const factor = next.adjustment!.factors[fi]!;
    const entry = factor.type === "categorical" ? factor.levels[ri]! : factor.bands[ri]!;
    entry[key] = value;
    onEdit(next);
  };

  const normalized = model.adjustment?.normalization === "population-average";

  return (
    <div className="space-y-5">
      {factors.map((factor, fi) => (
        <fieldset key={factor.id}>
          <legend className="mb-1 text-sm font-semibold">
            {factor.label} <span className="font-normal muted">({factor.input})</span>
          </legend>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left muted">
                <th className="py-1 font-normal">Level</th>
                <th className="py-1 font-normal">Hazard ratio</th>
                {normalized && <th className="py-1 font-normal">Share of population</th>}
              </tr>
            </thead>
            <tbody>
              {rows(factor).map((row, ri) => (
                <tr key={row.label}>
                  <td className="py-1 pr-3">{row.label}</td>
                  <td className="py-1 pr-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="field max-w-28"
                      aria-label={`${factor.label}, ${row.label}: hazard ratio`}
                      defaultValue={row.hazard_ratio}
                      onChange={(e) => update(fi, ri, "hazard_ratio", e.target.value)}
                    />
                  </td>
                  {normalized && (
                    <td className="py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        className="field max-w-28"
                        aria-label={`${factor.label}, ${row.label}: share of population`}
                        defaultValue={row.prevalence}
                        onChange={(e) => update(fi, ri, "prevalence", e.target.value)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {factor.notes && <p className="mt-1 text-xs muted">{factor.notes}</p>}
        </fieldset>
      ))}
      {normalized && (
        <p className="text-xs muted">
          Hazard ratios are rescaled so that someone with population-average exposure matches the
          baseline life table. Shares of the population must add up to 1 for each factor.
        </p>
      )}
    </div>
  );
}
