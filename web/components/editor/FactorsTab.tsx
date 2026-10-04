"use client";

import { useState } from "react";
import type { BandedFactor, CategoricalFactor, Factor, OlmModel } from "@openlifemodel/engine";
import { availableInputs, newFactor, normalizeShares, STANDARD_LABELS } from "@/lib/draft-model";
import { levelLabel } from "@/lib/labels";
import { AddButton, NumberField, RemoveButton, SectionIntro, SelectField, TextArea, TextField } from "./Fields";

type Edit = (change: (model: OlmModel) => void) => void;

const fmtShare = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function FactorsTab({ model, edit }: { model: OlmModel; edit: Edit }) {
  const factors = model.adjustment?.factors ?? [];
  const normalized = model.adjustment?.normalization !== "none";
  const options = availableInputs(model);
  const [toAdd, setToAdd] = useState("");
  const chosen = options.some((o) => o.id === toAdd) ? toAdd : (options[0]?.id ?? "");

  const addFactor = () =>
    edit((m) => {
      const factor = newFactor(m, chosen);
      if (m.adjustment) m.adjustment.factors.push(factor);
      else m.adjustment = { method: "proportional-hazards", normalization: "population-average", factors: [factor] };
    });

  return (
    <div className="space-y-5">
      <SectionIntro>
        Each risk factor multiplies the yearly risk of dying by a <strong>hazard ratio</strong>: 2.0 doubles it, 0.8
        lowers it by a fifth. <strong>Population shares</strong> say how common each level is, so that someone with
        average habits matches the life table.
      </SectionIntro>

      {factors.length > 0 && (
        <SelectField
          label="How hazard ratios relate to the life table"
          value={normalized ? "population-average" : "none"}
          options={[
            { value: "population-average", label: "Rescale so an average person matches the table (national tables)" },
            { value: "none", label: "Apply as written (the table describes the reference group)" },
          ]}
          onChange={(v) => edit((m) => void (m.adjustment!.normalization = v))}
        />
      )}

      {factors.map((factor, fi) => (
        <FactorCard key={`${factor.id}-${fi}`} model={model} factor={factor} index={fi} normalized={normalized} edit={edit} />
      ))}

      {factors.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">
          This model has no risk factors yet: it is the life table on its own. Add one below.
        </p>
      )}

      {options.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1 sm:flex-none">
            <SelectField
              label="Add a risk factor for"
              value={chosen}
              options={options.map((o) => ({ value: o.id, label: o.label }))}
              onChange={setToAdd}
            />
          </div>
          <AddButton onClick={addFactor}>Add risk factor</AddButton>
        </div>
      ) : (
        <p className="text-sm text-muted">Every available input already has a risk factor. Add a question to use something new.</p>
      )}
    </div>
  );
}

function FactorCard({
  model,
  factor,
  index,
  normalized,
  edit,
}: {
  model: OlmModel;
  factor: Factor;
  index: number;
  normalized: boolean;
  edit: Edit;
}) {
  const change = (fn: (f: Factor) => void) => edit((m) => fn(m.adjustment!.factors[index]!));
  const entries = factor.type === "categorical" ? factor.levels : factor.bands;
  const total = entries.reduce((sum, e) => sum + (e.prevalence ?? 0), 0);
  const sharesOff = normalized && Math.abs(total - 1) > 0.011;
  const inputChoices = [
    { value: factor.input, label: STANDARD_LABELS[factor.input] ?? model.inputs?.find((i) => i.id === factor.input)?.label ?? factor.input },
    ...availableInputs(model).map((o) => ({ value: o.id, label: o.label })),
  ];

  return (
    <section className="rounded-xl border border-line p-4 sm:p-5" aria-label={`Risk factor: ${factor.label}`}>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <TextField label="Label" value={factor.label} maxLength={40} onChange={(v) => change((f) => void (f.label = v))} />
        <SelectField
          label="Reads the answer to"
          value={factor.input}
          options={inputChoices}
          onChange={(input) =>
            edit((m) => {
              const old = m.adjustment!.factors[index]!;
              const fresh = newFactor(m, input);
              m.adjustment!.factors[index] = { ...fresh, id: old.id, label: fresh.label, ...(old.source && { source: old.source }) };
            })
          }
        />
        <RemoveButton
          label={`Remove risk factor ${factor.label}`}
          onClick={() =>
            edit((m) => {
              m.adjustment!.factors.splice(index, 1);
              if (m.adjustment!.factors.length === 0) delete m.adjustment;
            })
          }
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        {factor.type === "categorical" ? (
          <CategoricalTable model={model} factor={factor} normalized={normalized} change={change} />
        ) : (
          <BandedTable factor={factor} normalized={normalized} change={change} />
        )}
      </div>

      {normalized && (
        <div className={`mt-2 flex flex-wrap items-center gap-3 text-xs ${sharesOff ? "text-bad" : "text-muted"}`}>
          <span>Population shares add up to {fmtShare(total)}</span>
          {sharesOff && (
            <button type="button" className="font-medium text-accent-strong underline underline-offset-4" onClick={() => change((f) => Object.assign(f, normalizeShares(f)))}>
              Make them add up to 100%
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Source"
          value={factor.source ?? ""}
          options={[
            { value: "", label: "No source" },
            ...model.sources.map((s) => ({ value: s.id, label: s.citation.slice(0, 70) + (s.citation.length > 70 ? "…" : "") })),
          ]}
          onChange={(v) =>
            change((f) => {
              if (v === "") delete f.source;
              else f.source = v;
            })
          }
        />
        <SelectField
          label="If the person doesn't answer"
          value={factor.missing}
          options={[
            { value: "neutral", label: "Treat as average" },
            { value: "required", label: "Require an answer" },
          ]}
          onChange={(v) => change((f) => void (f.missing = v))}
        />
      </div>
      <div className="mt-3">
        <TextArea
          label="Notes (optional)"
          rows={2}
          value={factor.notes ?? ""}
          onChange={(v) =>
            change((f) => {
              if (v.trim() === "") delete f.notes;
              else f.notes = v;
            })
          }
        />
      </div>
    </section>
  );
}

const th = "pb-2 pr-3 text-left text-xs font-medium text-muted";

function CategoricalTable({
  model,
  factor,
  normalized,
  change,
}: {
  model: OlmModel;
  factor: CategoricalFactor;
  normalized: boolean;
  change: (fn: (f: Factor) => void) => void;
}) {
  const level = (i: number, fn: (l: CategoricalFactor["levels"][number]) => void) =>
    change((f) => fn((f as CategoricalFactor).levels[i]!));
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr>
          <th className={th}>Answer</th>
          <th className={`${th} w-24 sm:w-36`}>Hazard ratio</th>
          {normalized && <th className={`${th} w-24 sm:w-36`}>Share</th>}
        </tr>
      </thead>
      <tbody>
        {factor.levels.map((l, i) => (
          <tr key={l.value}>
            <td className="py-1 pr-3 text-muted">{levelLabel(model, factor, l.value)}</td>
            <td className="py-1 pr-3">
              <NumberField compact ariaLabel={`${factor.label}, ${l.value}: hazard ratio`} value={l.hazard_ratio} onChange={(v) => v !== undefined && level(i, (x) => void (x.hazard_ratio = v))} />
            </td>
            {normalized && (
              <td className="py-1">
                <NumberField compact optional ariaLabel={`${factor.label}, ${l.value}: population share`} value={l.prevalence} onChange={(v) => level(i, (x) => (v === undefined ? delete x.prevalence : void (x.prevalence = v)))} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BandedTable({
  factor,
  normalized,
  change,
}: {
  factor: BandedFactor;
  normalized: boolean;
  change: (fn: (f: Factor) => void) => void;
}) {
  const bands = factor.bands;
  const banded = (fn: (b: BandedFactor["bands"]) => void) => change((f) => fn((f as BandedFactor).bands));

  // Moving a boundary moves it for both neighbouring bands, so there are never gaps.
  const setBoundary = (i: number, v: number | undefined) =>
    banded((b) => {
      if (v === undefined) return;
      b[i]!.max = v;
      if (b[i + 1]) b[i + 1]!.min = v;
    });

  const addBand = () =>
    banded((b) => {
      const last = b[b.length - 1]!;
      const from = last.min ?? 0;
      const to = from === 0 ? 10 : Math.round(from * 1.5 * 100) / 100;
      last.max = to;
      b.push({ min: to, hazard_ratio: last.hazard_ratio, prevalence: 0 });
    });

  const removeBand = (i: number) =>
    banded((b) => {
      const removed = b[i]!;
      b.splice(i, 1);
      if (i === 0) delete b[0]!.min;
      else if (i === b.length) delete b[i - 1]!.max;
      else if (removed.min !== undefined) b[i]!.min = removed.min;
    });

  return (
    <>
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr>
            <th className={`${th} w-24`}>From</th>
            <th className={`${th} w-32`}>Up to (not incl.)</th>
            <th className={`${th} w-32`}>Hazard ratio</th>
            {normalized && <th className={`${th} w-32`}>Population share</th>}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {bands.map((b, i) => (
            <tr key={i}>
              <td className="py-1 pr-3 tabular-nums text-muted">{b.min === undefined ? "lowest" : b.min}</td>
              <td className="py-1 pr-3">
                {b.max === undefined ? (
                  <span className="text-muted">highest</span>
                ) : (
                  <NumberField compact ariaLabel={`${factor.label}, band ${i + 1}: upper bound`} value={b.max} onChange={(v) => setBoundary(i, v)} />
                )}
              </td>
              <td className="py-1 pr-3">
                <NumberField compact ariaLabel={`${factor.label}, band ${i + 1}: hazard ratio`} value={b.hazard_ratio} onChange={(v) => v !== undefined && banded((x) => void (x[i]!.hazard_ratio = v))} />
              </td>
              {normalized && (
                <td className="py-1 pr-3">
                  <NumberField compact optional ariaLabel={`${factor.label}, band ${i + 1}: population share`} value={b.prevalence} onChange={(v) => banded((x) => (v === undefined ? delete x[i]!.prevalence : void (x[i]!.prevalence = v)))} />
                </td>
              )}
              <td className="py-1">
                {bands.length > 2 && <RemoveButton label={`Remove band ${i + 1}`} onClick={() => removeBand(i)} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2">
        <AddButton onClick={addBand}>Add band</AddButton>
      </div>
    </>
  );
}
