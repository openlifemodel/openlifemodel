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
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const NUMERIC_INPUTS: Record<
  Exclude<FactorInput, "smoking_status">,
  { label: string; unit: string; hint: string; step: string; min: number; max: number }
> = {
  bmi: { label: "Body mass index", unit: "kg/m²", hint: "", step: "0.1", min: 10, max: 80 },
  mvpa_minutes_per_week: {
    label: "Exercise",
    unit: "min / week",
    hint: "Leisure activity that makes you breathe harder: brisk walking, cycling, sport. Count vigorous minutes (running, fast cycling) twice.",
    step: "10",
    min: 0,
    max: 5000,
  },
  systolic_bp: { label: "Systolic blood pressure", unit: "mmHg", hint: "The higher number, e.g. 120 in 120/80.", step: "1", min: 60, max: 260 },
  alcohol_drinks_per_week: { label: "Alcohol", unit: "drinks / week", hint: "One drink ≈ 14 g of alcohol.", step: "1", min: 0, max: 200 },
};

const FIELD_NAMES: Record<string, string> = {
  age: "Age",
  sex: "Sex",
  smoking_status: "Smoking",
  bmi: "Body mass index",
  systolic_bp: "Blood pressure",
  mvpa_minutes_per_week: "Exercise",
  alcohol_drinks_per_week: "Alcohol",
};

/** Turn schema errors such as "/age must be <= 119" into plain sentences. */
function friendly(errors: string[]): string[] {
  return errors.map((e) => {
    const field = /^\/(\w+)/.exec(e)?.[1];
    if (field === "age") return "Enter your age as a whole number between 0 and 119.";
    if (field && field in NUMERIC_INPUTS) {
      const { min, max } = NUMERIC_INPUTS[field as keyof typeof NUMERIC_INPUTS];
      return `${FIELD_NAMES[field]} should be between ${min} and ${max}.`;
    }
    return field ? `${FIELD_NAMES[field] ?? field}: ${e.replace(/^\/\w+\s*/, "")}` : e;
  });
}

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
    // Model files are small text files; large files are almost certainly something else.
    if (file.size > MAX_IMPORT_BYTES) {
      setImportErrors([`${file.name}: this file is too large to be an OLM model (limit 2 MB).`]);
      return;
    }
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

  const numericFields = (Object.keys(NUMERIC_INPUTS) as (keyof typeof NUMERIC_INPUTS)[]).filter((k) => usedInputs.has(k));
  const sexWord = profile.sex === "female" ? "woman" : "man";

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        {/* Profile */}
        <section className="card p-5 sm:p-6" aria-labelledby="profile-heading">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 id="profile-heading" className="text-lg font-semibold tracking-tight">
              About you
            </h2>
            <span className="text-xs text-faint">Leave blank if unsure</span>
          </div>
          <div className="space-y-5">
            <div className="grid grid-cols-[6.5rem_1fr] gap-3">
              <label className="block">
                <span className="label">Age</span>
                <input type="number" inputMode="numeric" min="0" max="119" step="1" className="field" value={draft.age} onChange={set("age")} />
              </label>
              <fieldset>
                <legend className="label">Sex</legend>
                <div className="segmented">
                  {(["male", "female"] as const).map((sex) => (
                    <label key={sex}>
                      <input type="radio" name="sex" value={sex} checked={draft.sex === sex} onChange={set("sex")} />
                      <span>{sex === "male" ? "Male" : "Female"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {usedInputs.has("smoking_status") && (
              <label className="block">
                <span className="label">Smoking</span>
                <select className="field" value={draft.smoking_status} onChange={set("smoking_status")}>
                  <option value="">Prefer not to say</option>
                  <option value="never">Never smoked</option>
                  <option value="current">Smoke now</option>
                  <optgroup label="Used to smoke, quit at age…">
                    <option value="former_quit_before_35">Quit before 35</option>
                    <option value="former_quit_35_44">Quit at 35–44</option>
                    <option value="former_quit_45_54">Quit at 45–54</option>
                    <option value="former_quit_55_plus">Quit at 55 or later</option>
                    <option value="former">Quit, don&apos;t remember when</option>
                  </optgroup>
                </select>
              </label>
            )}

            {numericFields.map((k) => {
              const meta = NUMERIC_INPUTS[k];
              return (
                <div key={k}>
                  <label className="block">
                    <span className="label">{meta.label}</span>
                    <span className="unit-field block">
                      <input
                        type="number"
                        inputMode="decimal"
                        step={meta.step}
                        min={meta.min}
                        max={meta.max}
                        className="field"
                        value={draft[k]}
                        placeholder={k === "bmi" && bmiFromHeight !== null ? String(bmiFromHeight) : ""}
                        onChange={set(k)}
                      />
                      <span>{meta.unit}</span>
                    </span>
                  </label>
                  {meta.hint && <p className="hint">{meta.hint}</p>}
                  {k === "bmi" && draft.bmi === "" && (
                    <details className="mt-2" open={draft.height_cm !== "" || draft.weight_kg !== ""}>
                      <summary className="cursor-pointer text-xs font-medium text-accent-strong">
                        Don&apos;t know it? Use height and weight
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <label className="unit-field block">
                          <span className="sr-only">Height</span>
                          <input type="number" inputMode="decimal" min="50" max="250" className="field" placeholder="Height" value={draft.height_cm} onChange={set("height_cm")} />
                          <span>cm</span>
                        </label>
                        <label className="unit-field block">
                          <span className="sr-only">Weight</span>
                          <input type="number" inputMode="decimal" min="20" max="300" className="field" placeholder="Weight" value={draft.weight_kg} onChange={set("weight_kg")} />
                          <span>kg</span>
                        </label>
                      </div>
                      {bmiFromHeight !== null && <p className="hint">Your BMI: {bmiFromHeight}</p>}
                    </details>
                  )}
                </div>
              );
            })}

            <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
              <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
              </svg>
              Calculated in your browser. This site never sends your answers anywhere.
            </p>
          </div>
        </section>

        {/* Results */}
        <section className="card p-5 sm:p-6 lg:sticky lg:top-20" aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">
            Your results
          </h2>
          <div aria-live="polite">
            {"errors" in outcome ? (
              <div className="rounded-lg bg-bad-soft p-4 text-sm text-bad">
                <p className="font-medium">Check your answers</p>
                <ul className="mt-1 list-disc pl-5">
                  {friendly(outcome.errors).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <Results result={outcome.result} population={outcome.population} who={`${profile.age}-year-old ${sexWord}`} />
            )}
          </div>
        </section>
      </div>

      {/* Model */}
      <section className="card p-5 sm:p-6" aria-labelledby="model-heading">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 basis-64">
            <span id="model-heading" className="label">
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
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />
              </svg>
              Import
            </button>
            <button
              type="button"
              className="btn"
              disabled={!model || modelErrors.length > 0}
              onClick={() => model && download(`${model.id}.olm.yaml`, serializeModel(model))}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
              </svg>
              Export
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".yaml,.yml,.olm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = "";
            }}
          />
        </div>
        {model && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <span className={`pill ${model.status === "illustrative" ? "!border-bad !text-bad" : ""}`}>
              {model.status === "published" ? "Published data" : model.status === "experimental" ? "Experimental" : "Illustrative only"}
            </span>
            <span className="pill">v{model.version}</span>
            <span className="pill">{model.sources.length} source{model.sources.length === 1 ? "" : "s"}</span>
            {entry?.origin === "bundled" && (
              <a href={`/models/${model.id}/`} className="font-medium text-accent-strong underline underline-offset-4">
                Sources and assumptions
              </a>
            )}
          </div>
        )}
        {model && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">{model.description}</p>}
        {importErrors.length > 0 && (
          <ul role="alert" className="mt-3 list-disc rounded-lg bg-bad-soft py-3 pl-8 pr-4 text-sm text-bad">
            {importErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {model && (
          <details className="group mt-5 border-t border-line pt-4" open={entry?.origin === "edited"}>
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
              <svg className="transition group-open:rotate-90" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 6 6 6-6 6" />
              </svg>
              Edit this model&apos;s assumptions
              <span className="text-xs font-normal text-faint">Change a number and the results update</span>
            </summary>
            <div className="mt-4">
              {modelErrors.length > 0 && (
                <ul role="alert" className="mb-4 list-disc rounded-lg bg-bad-soft py-3 pl-8 pr-4 text-sm text-bad">
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
      </section>
    </div>
  );
}

function Results({ result, population, who }: { result: CalculationResult; population: CalculationResult; who: string }) {
  const diff = result.remaining_life_expectancy - population.remaining_life_expectancy;
  const factors = result.factors.filter((f) => f.value !== null);
  const maxYears = Math.max(...factors.map((f) => Math.abs(f.life_years)), 1);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-muted">Estimated age at death</div>
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="text-6xl font-semibold tracking-tight tabular-nums text-fg">{fmt(result.expected_age_at_death)}</div>
          {Math.abs(diff) >= 0.05 ? (
            <span
              className={`mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${diff > 0 ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}
            >
              {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))} years vs average
            </span>
          ) : (
            <span className="mb-2 text-sm text-muted">Average for a {who}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          {Math.abs(diff) >= 0.05 ? `Compared with an average ${who}. ` : ""}A statistical average, not a prediction for you.
        </p>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface-2">
        <Stat label="Years remaining" value={fmt(result.remaining_life_expectancy)} />
        <Stat label="Half reach" value={fmt(result.median_age_at_death, 0)} />
        <Stat label="Chance of 90" value={pct(result.survival_to[90])} />
      </dl>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Chance of being alive at each age</h3>
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-accent" /> You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-[var(--chart-base)]" /> Average {who}
            </span>
          </div>
        </div>
        <SurvivalChart you={result.survival_curve} population={population.survival_curve} medianAge={result.median_age_at_death} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([80, 90, 100] as const).map((age) => {
          const p = result.survival_to[age];
          const avg = population.survival_to[age];
          return (
            <div key={age} className="rounded-xl border border-line p-3">
              <div className="text-xs text-muted">Reaching {age}</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">{pct(p)}</div>
              {p !== null && avg !== null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(p * 100, 1)}%` }} />
                </div>
              )}
              {avg !== null && <div className="mt-1 text-[11px] text-faint">Average {pct(avg)}</div>}
            </div>
          );
        })}
      </div>

      {factors.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">What moves your estimate</h3>
          <ul className="space-y-3">
            {factors.map((f) => (
              <li key={f.id} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 text-sm">
                <span className="truncate text-muted">{f.label}</span>
                <span className="relative h-2.5 rounded-full bg-surface-2" aria-hidden="true">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                  <span
                    className={`absolute inset-y-0 rounded-full ${f.life_years >= 0 ? "left-1/2 bg-good" : "right-1/2 bg-bad"}`}
                    style={{ width: `${(Math.abs(f.life_years) / maxYears) * 50}%` }}
                  />
                </span>
                <span className={`text-right font-semibold tabular-nums ${f.life_years >= 0 ? "text-good" : "text-bad"}`}>
                  {f.life_years >= 0 ? "+" : "−"}
                  {fmt(Math.abs(f.life_years))} y
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">
            Years gained or lost compared with an average value for each factor. They don&apos;t add up exactly because
            risks multiply.
          </p>
        </div>
      )}

      {result.warnings.length > 0 && (
        <p className="text-xs leading-relaxed text-faint">
          Not answered, so treated as average: {result.warnings.map((w) => w.split(":")[0]).join(", ")}.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center sm:px-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
