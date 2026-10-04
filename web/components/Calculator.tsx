"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculate,
  OlmValidationError,
  parseModel,
  serializeModel,
  validateModel,
  type CalculationResult,
  type FactorInput,
  type OlmModel,
  type PersonProfile,
} from "@openlifemodel/engine";
import { ModelEditor } from "./ModelEditor";
import { SurvivalChart } from "./SurvivalChart";

type Origin = "bundled" | "imported" | "edited";

interface Entry {
  key: string;
  /** Key of the entry this one was derived from; keeps the editor stable while typing. */
  root: string;
  origin: Origin;
  model: OlmModel;
}

type Draft = Record<"age" | "sex" | FactorInput | "height_cm" | "weight_kg", string>;

const EMPTY_DRAFT: Draft = {
  age: "40",
  sex: "male",
  smoking_status: "",
  bmi: "",
  height_cm: "",
  weight_kg: "",
  systolic_bp: "",
  mvpa_minutes_per_week: "",
  alcohol_drinks_per_week: "",
};

const STORAGE_KEY = "olm.profile.v1";

const NUMERIC_INPUTS: Record<Exclude<FactorInput, "smoking_status">, { label: string; hint: string; step: string }> = {
  bmi: { label: "Body mass index (kg/m²)", hint: "Or enter height and weight below.", step: "0.1" },
  systolic_bp: { label: "Systolic blood pressure (mmHg)", hint: "The higher number, e.g. 120 in 120/80.", step: "1" },
  mvpa_minutes_per_week: {
    label: "Exercise (minutes per week)",
    hint: "Moderate or vigorous activity: brisk walking, cycling, running, sport.",
    step: "10",
  },
  alcohol_drinks_per_week: { label: "Alcoholic drinks per week", hint: "One drink ≈ 14 g of alcohol.", step: "1" },
};

function toProfile(draft: Draft): { profile: PersonProfile; bmiFromHeight: number | null } {
  const profile: PersonProfile = { age: Number(draft.age), sex: draft.sex as PersonProfile["sex"] };
  if (draft.smoking_status) profile.smoking_status = draft.smoking_status as NonNullable<PersonProfile["smoking_status"]>;
  for (const key of Object.keys(NUMERIC_INPUTS) as (keyof typeof NUMERIC_INPUTS)[]) {
    if (draft[key].trim() !== "") profile[key] = Number(draft[key]);
  }
  let bmiFromHeight: number | null = null;
  const h = Number(draft.height_cm) / 100;
  const w = Number(draft.weight_kg);
  if (profile.bmi === undefined && h > 0 && w > 0) {
    bmiFromHeight = Math.round((w / (h * h)) * 10) / 10;
    profile.bmi = bmiFromHeight;
  }
  return { profile, bmiFromHeight };
}

function errorText(err: unknown): string[] {
  return err instanceof OlmValidationError ? err.errors : [String(err)];
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/x-yaml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = (n: number, digits = 1) => n.toFixed(digits);
const pct = (p: number | null) => (p === null ? "n/a" : p < 0.001 ? "<0.1%" : `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`);

export function Calculator({ models }: { models: OlmModel[] }) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    models.map((m) => ({ key: m.id, root: m.id, origin: "bundled", model: m })),
  );
  const [selected, setSelected] = useState(models[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [editorReset, setEditorReset] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Remember the profile in this browser only. Saving waits until the saved
  // profile has been restored, so the defaults never overwrite it.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(saved) as Partial<Draft>) });
    } catch {
      // Storage unavailable: start from the defaults.
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore: remembering the profile is a convenience.
    }
  }, [draft, restored]);

  const entry = entries.find((e) => e.key === selected) ?? entries[0];
  const model = entry?.model;
  const usedInputs = new Set(model?.adjustment?.factors.map((f) => f.input) ?? []);
  const { profile, bmiFromHeight } = toProfile(draft);

  const modelErrors = useMemo(() => {
    if (!model || entry?.origin !== "edited") return [];
    try {
      validateModel(model);
      return [];
    } catch (err) {
      return errorText(err);
    }
  }, [model, entry?.origin]);

  const outcome = useMemo((): { result: CalculationResult; population: CalculationResult } | { errors: string[] } => {
    if (!model) return { errors: ["No model selected."] };
    try {
      return {
        result: calculate(model, profile),
        population: calculate(model, { age: profile.age, sex: profile.sex }),
      };
    } catch (err) {
      return { errors: errorText(err) };
    }
  }, [model, JSON.stringify(profile)]);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  const onEdit = (next: OlmModel) => {
    if (!entry) return;
    const base = entry.origin === "edited" ? entries.find((e) => e.key === entry.root)?.model : entry.model;
    const edited: OlmModel = {
      ...next,
      id: `${base?.id ?? next.id}-custom`,
      name: `${base?.name ?? next.name} (edited)`,
      version: `${base?.version ?? next.version}-custom`,
      status: next.status === "published" ? "experimental" : next.status,
    };
    // Reference tests describe the original numbers, so they no longer apply.
    delete edited.tests;
    const key = `${entry.root}:edited`;
    setEntries((list) => [
      ...list.filter((e) => e.key !== key),
      { key, root: entry.root, origin: "edited", model: edited },
    ]);
    setSelected(key);
  };

  const resetEdits = () => {
    if (!entry) return;
    setEntries((list) => list.filter((e) => e.key !== `${entry.root}:edited`));
    setSelected(entry.root);
    setEditorReset((n) => n + 1);
  };

  const onImport = async (file: File) => {
    setImportErrors([]);
    try {
      const imported = parseModel(await file.text());
      const key = `imported:${imported.id}`;
      setEntries((list) => [
        ...list.filter((e) => e.key !== key),
        { key, root: key, origin: "imported", model: imported },
      ]);
      setSelected(key);
    } catch (err) {
      setImportErrors([`${file.name}:`, ...errorText(err)]);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* Profile */}
      <section className="card p-5" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="mb-4 font-semibold">
          Your profile
        </h2>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block">Age</span>
              <input type="number" min="0" max="119" step="1" className="field" value={draft.age} onChange={set("age")} />
            </label>
            <label className="block">
              <span className="mb-1 block">Sex</span>
              <select className="field" value={draft.sex} onChange={set("sex")}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
          </div>

          {usedInputs.has("smoking_status") && (
            <label className="block">
              <span className="mb-1 block">Smoking</span>
              <select className="field" value={draft.smoking_status} onChange={set("smoking_status")}>
                <option value="">Prefer not to say</option>
                <option value="never">Never smoked</option>
                <option value="former">Former smoker</option>
                <option value="current">Current smoker</option>
              </select>
            </label>
          )}

          {(Object.keys(NUMERIC_INPUTS) as (keyof typeof NUMERIC_INPUTS)[])
            .filter((k) => usedInputs.has(k))
            .map((k) => (
              <div key={k}>
                <label className="block">
                  <span className="mb-1 block">{NUMERIC_INPUTS[k].label}</span>
                  <input
                    type="number"
                    step={NUMERIC_INPUTS[k].step}
                    min="0"
                    className="field"
                    value={draft[k]}
                    placeholder={k === "bmi" && bmiFromHeight !== null ? String(bmiFromHeight) : "Leave blank if unknown"}
                    onChange={set(k)}
                  />
                </label>
                <p className="mt-1 text-xs muted">{NUMERIC_INPUTS[k].hint}</p>
                {k === "bmi" && draft.bmi === "" && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs">Height (cm)</span>
                      <input type="number" min="50" max="250" className="field" value={draft.height_cm} onChange={set("height_cm")} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs">Weight (kg)</span>
                      <input type="number" min="20" max="300" className="field" value={draft.weight_kg} onChange={set("weight_kg")} />
                    </label>
                  </div>
                )}
              </div>
            ))}
          <p className="text-xs muted">
            Everything is calculated in your browser. Nothing you enter is sent anywhere.
          </p>
        </div>
      </section>

      <div className="min-w-0 space-y-6">
        {/* Model choice */}
        <section className="card p-5" aria-labelledby="model-heading">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1">
              <span id="model-heading" className="mb-1 block text-sm font-semibold">
                Model
              </span>
              <select className="field" value={entry?.key} onChange={(e) => setSelected(e.target.value)}>
                {entries.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.model.name}
                    {e.origin === "imported" ? " (imported)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
              Import .olm
            </button>
            <button
              type="button"
              className="btn"
              disabled={!model || modelErrors.length > 0}
              onClick={() => model && download(`${model.id}.olm`, serializeModel(model))}
            >
              Export .olm
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".olm,.yaml,.yml"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onImport(file);
                e.target.value = "";
              }}
            />
          </div>
          {model && (
            <p className="mt-3 text-sm muted">
              {model.status === "illustrative" && (
                <strong className="text-[var(--color-bad)]">Illustrative only, not evidence-based. </strong>
              )}
              {model.description}
            </p>
          )}
          {importErrors.length > 0 && (
            <ul role="alert" className="mt-3 list-disc pl-5 text-sm text-[var(--color-bad)]">
              {importErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Results */}
        <section className="card p-5" aria-labelledby="results-heading" aria-live="polite">
          <h2 id="results-heading" className="sr-only">
            Results
          </h2>
          {"errors" in outcome ? (
            <ul className="list-disc pl-5 text-sm text-[var(--color-bad)]">
              {outcome.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <Results result={outcome.result} population={outcome.population} />
          )}
        </section>

        {/* Editor */}
        {model && (
          <details className="card p-5" open={entry?.origin === "edited"}>
            <summary className="cursor-pointer font-semibold">Edit this model&apos;s assumptions</summary>
            <div className="mt-4">
              {modelErrors.length > 0 && (
                <ul role="alert" className="mb-4 list-disc pl-5 text-sm text-[var(--color-bad)]">
                  {modelErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
              <ModelEditor key={`${entry?.root}:${editorReset}`} model={model} onEdit={onEdit} />
              {entry?.origin === "edited" && (
                <button type="button" className="btn mt-4" onClick={resetEdits}>
                  Undo all edits
                </button>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function Results({ result, population }: { result: CalculationResult; population: CalculationResult }) {
  const diff = result.remaining_life_expectancy - population.remaining_life_expectancy;
  const factors = result.factors.filter((f) => f.value !== null);
  const maxYears = Math.max(...factors.map((f) => Math.abs(f.life_years)), 0.1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Expected age at death" value={fmt(result.expected_age_at_death)} />
        <Stat label="Remaining years" value={fmt(result.remaining_life_expectancy)} />
        <Stat label="Median age at death" value={fmt(result.median_age_at_death)} />
      </div>

      {Math.abs(diff) >= 0.05 && (
        <p className="text-sm">
          That is{" "}
          <strong className={diff > 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}>
            {fmt(Math.abs(diff))} years {diff > 0 ? "more" : "less"}
          </strong>{" "}
          than the average for your age and sex under this model.
        </p>
      )}

      <div>
        <SurvivalChart you={result.survival_curve} population={population.survival_curve} medianAge={result.median_age_at_death} />
        <p className="mt-1 flex flex-wrap gap-4 text-xs muted">
          <span>
            <span className="mr-1 inline-block h-0.5 w-5 align-middle bg-[var(--color-accent)]" />
            You
          </span>
          <span>
            <span className="mr-1 inline-block w-5 border-t-2 border-dashed align-middle border-[var(--chart-base)]" />
            Average for your age and sex
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-4 text-center">
        {([80, 90, 100] as const).map((age) => (
          <div key={age}>
            <dt className="text-xs muted">Reaching {age}</dt>
            <dd className="text-lg font-semibold">{pct(result.survival_to[age])}</dd>
          </div>
        ))}
      </dl>

      {factors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">What moves your estimate</h3>
          <ul className="space-y-2 text-sm">
            {factors.map((f) => (
              <li key={f.id} className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-3">
                <span className="truncate">{f.label}</span>
                <span className="relative h-2 rounded bg-[var(--border)]">
                  <span
                    className={`absolute top-0 h-2 rounded ${f.life_years >= 0 ? "left-1/2 bg-[var(--color-good)]" : "right-1/2 bg-[var(--color-bad)]"}`}
                    style={{ width: `${(Math.abs(f.life_years) / maxYears) * 50}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  {f.life_years >= 0 ? "+" : "−"}
                  {fmt(Math.abs(f.life_years))} y
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs muted">
            Years gained or lost compared with a population-average value for each factor. These do not add up exactly
            because risks multiply.
          </p>
        </div>
      )}

      {result.warnings.length > 0 && (
        <ul className="list-disc pl-5 text-xs muted">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-accent-soft)] p-4">
      <div className="text-xs">{label}</div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
