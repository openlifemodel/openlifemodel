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
  type FactorLevel,
  type FactorResult,
  type OlmModel,
  type PersonProfile,
} from "@openlifemodel/engine";
import { LEVEL_LABELS } from "@/lib/labels";
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

type BodyField = "height_cm" | "weight_kg" | "height_ft" | "height_in" | "weight_lb";
type Draft = Record<"age" | "sex" | FactorInput | BodyField | "units", string>;
type Units = "metric" | "us";

const EMPTY_DRAFT: Draft = {
  age: "40",
  sex: "male",
  smoking_status: "",
  bmi: "",
  height_cm: "",
  weight_kg: "",
  height_ft: "",
  height_in: "",
  weight_lb: "",
  units: "",
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

/** BMI from the height and weight helper, in whichever units are selected; null if incomplete. */
function bmiFromBody(draft: Draft): number | null {
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  let metres: number;
  let kg: number;
  if (draft.units === "us") {
    const inches = num(draft.height_ft || "0") * 12 + num(draft.height_in || "0");
    metres = inches * 0.0254;
    kg = num(draft.weight_lb) * 0.45359237;
    if (draft.height_ft.trim() === "" && draft.height_in.trim() === "") return null;
  } else {
    metres = num(draft.height_cm) / 100;
    kg = num(draft.weight_kg);
  }
  if (!(metres > 0.5 && metres < 2.6 && kg > 15 && kg < 350)) return null;
  return Math.round((kg / (metres * metres)) * 10) / 10;
}

/** Convert the helper's values when the units are switched, so nothing is lost. */
function switchUnits(draft: Draft, units: Units): Draft {
  if (draft.units === units) return draft;
  const round = (n: number, dp = 0) => String(Math.round(n * 10 ** dp) / 10 ** dp);
  const next = { ...draft, units };
  if (units === "us") {
    const cm = Number(draft.height_cm);
    const kg = Number(draft.weight_kg);
    if (draft.height_cm && cm > 0) {
      const inches = cm / 2.54;
      next.height_ft = String(Math.floor(inches / 12));
      next.height_in = round(inches % 12);
    }
    if (draft.weight_kg && kg > 0) next.weight_lb = round(kg / 0.45359237);
  } else {
    const inches = Number(draft.height_ft || 0) * 12 + Number(draft.height_in || 0);
    const lb = Number(draft.weight_lb);
    if ((draft.height_ft || draft.height_in) && inches > 0) next.height_cm = round(inches * 2.54);
    if (draft.weight_lb && lb > 0) next.weight_kg = round(lb * 0.45359237, 1);
  }
  return next;
}

/** US visitors (by browser locale) start in US units; everyone else in metric. */
function defaultUnits(): Units {
  try {
    const locale = new Intl.Locale(navigator.language);
    return ["US", "LR", "MM"].includes(locale.maximize().region ?? "") ? "us" : "metric";
  } catch {
    return "metric";
  }
}

function toProfile(draft: Draft): PersonProfile {
  const profile: PersonProfile = { age: Number(draft.age), sex: draft.sex as PersonProfile["sex"] };
  if (draft.smoking_status) profile.smoking_status = draft.smoking_status as NonNullable<PersonProfile["smoking_status"]>;
  for (const key of Object.keys(NUMERIC_INPUTS) as (keyof typeof NUMERIC_INPUTS)[]) {
    if (draft[key].trim() !== "") profile[key] = Number(draft[key]);
  }
  if (profile.bmi === undefined) {
    const bmi = bmiFromBody(draft);
    if (bmi !== null) profile.bmi = bmi;
  }
  return profile;
}

function pickBody(d: Draft) {
  return { cm: d.height_cm, kg: d.weight_kg, ft: d.height_ft, inch: d.height_in, lb: d.weight_lb };
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
      const restoredDraft = saved ? { ...EMPTY_DRAFT, ...(JSON.parse(saved) as Partial<Draft>) } : EMPTY_DRAFT;
      setDraft({ ...restoredDraft, units: restoredDraft.units || defaultUnits() });
    } catch {
      // Storage unavailable: start from the defaults.
      setDraft((d) => ({ ...d, units: d.units || defaultUnits() }));
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
  const profile = toProfile(draft);
  const bodyBmi = bmiFromBody(draft);

  const modelErrors = useMemo(() => {
    if (!model || entry?.origin !== "edited") return [];
    try {
      validateModel(model);
      return [];
    } catch (err) {
      return errorText(err);
    }
  }, [model, entry?.origin]);

  const outcome = useMemo((): Outcome | { errors: string[] } => {
    if (!model) return { errors: ["No model selected."] };
    try {
      const result = calculate(model, profile);
      // For current smokers, what quitting now would do (the quit-age band for their age).
      let quitNow: number | null = null;
      if (profile.smoking_status === "current" && usedInputs.has("smoking_status")) {
        const quitting = calculate(model, { ...profile, smoking_status: quitBandFor(profile.age) });
        quitNow = quitting.factors.find((f) => f.input === "smoking_status")?.life_years ?? null;
      }
      return { result, population: calculate(model, { age: profile.age, sex: profile.sex }), quitNow };
    } catch (err) {
      return { errors: errorText(err) };
    }
  }, [model, JSON.stringify(profile)]);

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  // Height and weight fill in the BMI box, so people can see and keep the number.
  const setBody = (key: BodyField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => {
      const next = { ...d, [key]: e.target.value };
      const bmi = bmiFromBody(next);
      return bmi === null ? next : { ...next, bmi: String(bmi) };
    });

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
                        placeholder={k === "bmi" ? "e.g. 24" : ""}
                        onChange={set(k)}
                      />
                      <span>{meta.unit}</span>
                    </span>
                  </label>
                  {meta.hint && <p className="hint">{meta.hint}</p>}
                  {k === "bmi" && (
                    <details className="mt-2" open={Object.values(pickBody(draft)).some((v) => v !== "")}>
                      <summary className="cursor-pointer text-xs font-medium text-accent-strong">
                        Don&apos;t know it? Use height and weight
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div className="segmented max-w-56 text-xs" role="radiogroup" aria-label="Units">
                          {(["metric", "us"] as const).map((u) => (
                            <label key={u}>
                              <input
                                type="radio"
                                name="units"
                                value={u}
                                checked={(draft.units || "metric") === u}
                                onChange={() => setDraft((d) => switchUnits({ ...d, units: d.units || "metric" }, u))}
                              />
                              <span className="!py-1 !text-xs">{u === "metric" ? "cm / kg" : "ft, in / lb"}</span>
                            </label>
                          ))}
                        </div>
                        {draft.units === "us" ? (
                          <div className="grid grid-cols-3 gap-2">
                            <label className="unit-field block">
                              <span className="sr-only">Height, feet</span>
                              <input type="number" inputMode="numeric" min="2" max="8" className="field !pr-8" placeholder="5" value={draft.height_ft} onChange={setBody("height_ft")} />
                              <span>ft</span>
                            </label>
                            <label className="unit-field block">
                              <span className="sr-only">Height, inches</span>
                              <input type="number" inputMode="decimal" min="0" max="11.9" className="field !pr-8" placeholder="9" value={draft.height_in} onChange={setBody("height_in")} />
                              <span>in</span>
                            </label>
                            <label className="unit-field block">
                              <span className="sr-only">Weight, pounds</span>
                              <input type="number" inputMode="decimal" min="40" max="700" className="field !pr-8" placeholder="170" value={draft.weight_lb} onChange={setBody("weight_lb")} />
                              <span>lb</span>
                            </label>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="unit-field block">
                              <span className="sr-only">Height in centimetres</span>
                              <input type="number" inputMode="decimal" min="50" max="250" className="field" placeholder="Height" value={draft.height_cm} onChange={setBody("height_cm")} />
                              <span>cm</span>
                            </label>
                            <label className="unit-field block">
                              <span className="sr-only">Weight in kilograms</span>
                              <input type="number" inputMode="decimal" min="20" max="300" className="field" placeholder="Weight" value={draft.weight_kg} onChange={setBody("weight_kg")} />
                              <span>kg</span>
                            </label>
                          </div>
                        )}
                        <p className="hint !mt-1">
                          {bodyBmi === null
                            ? "BMI is weight divided by height squared. Enter both and we'll work it out."
                            : Number(draft.bmi) === bodyBmi
                              ? `That's a BMI of ${bodyBmi}, filled in above.`
                              : `Your height and weight give a BMI of ${bodyBmi}.`}
                        </p>
                      </div>
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
              <Results
              result={outcome.result}
              population={outcome.population}
              quitNow={outcome.quitNow}
              who={`${profile.age}-year-old ${sexWord}`}
            />
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

interface Outcome {
  result: CalculationResult;
  population: CalculationResult;
  quitNow: number | null;
}

function quitBandFor(age: number): NonNullable<PersonProfile["smoking_status"]> {
  if (age < 35) return "former_quit_before_35";
  if (age < 45) return "former_quit_35_44";
  if (age < 55) return "former_quit_45_54";
  return "former_quit_55_plus";
}

function Results({ result, population, quitNow, who }: Outcome & { who: string }) {
  const diff = result.remaining_life_expectancy - population.remaining_life_expectancy;
  const factors = result.factors.filter((f) => f.value !== null);

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

      {factors.length > 0 && <FactorList factors={factors} quitNow={quitNow} />}

      {result.warnings.length > 0 && (
        <p className="text-xs leading-relaxed text-faint">
          Not answered, so treated as average: {result.warnings.map((w) => w.split(":")[0]).join(", ")}.
        </p>
      )}
    </div>
  );
}

const UNIT_PHRASES: Partial<Record<FactorInput, (range: string) => string>> = {
  bmi: (r) => `BMI ${r}`,
  mvpa_minutes_per_week: (r) => `${r} min/week`,
  systolic_bp: (r) => `${r} mmHg`,
  alcohol_drinks_per_week: (r) => `${r} drinks/week`,
};

/** "never smoked or quit before 35", "450–1,500 min/week", "BMI 18.5–25". */
function describeLevels(input: FactorInput, levels: FactorLevel[]): string {
  if (levels.every((l) => typeof l === "string")) {
    return (levels as string[]).map((l) => (LEVEL_LABELS[l] ?? l).toLowerCase()).join(" or ");
  }
  // Adjacent bands with the same effect read better as one range.
  const bands = levels.filter((l): l is { min?: number; max?: number } => typeof l !== "string");
  const min = bands[0]?.min;
  const max = bands[bands.length - 1]?.max;
  const n = (x: number) => x.toLocaleString("en-US");
  const range = min === undefined ? `under ${n(max ?? 0)}` : max === undefined ? `${n(min)} or more` : `${n(min)}–${n(max)}`;
  return UNIT_PHRASES[input]?.(range) ?? range;
}

const signed = (y: number) => `${y >= 0 ? "+" : "−"}${fmt(Math.abs(y))} y`;

/** The note under a factor: how close to the best level, phrased for what can still change. */
function factorNote(f: FactorResult, quitNow: number | null): { text: string; good: boolean } {
  const atBest = f.life_years >= f.best_life_years - 0.05;
  if (f.input === "smoking_status" && f.value !== "never") {
    if (f.value === "current" && quitNow !== null) {
      return { text: `Quitting now: about ${signed(quitNow - f.life_years)}`, good: true };
    }
    return { text: "Set by the age you quit", good: false };
  }
  if (atBest) return { text: "At the best level in this model", good: true };
  return { text: `Best ${signed(f.best_life_years)} with ${describeLevels(f.input, f.best_levels)}`, good: false };
}

function FactorList({ factors, quitNow }: { factors: FactorResult[]; quitNow: number | null }) {
  // One shared scale so factors can be compared: worst possible to best possible.
  const lo = Math.min(0, ...factors.map((f) => f.worst_life_years));
  const hi = Math.max(0, ...factors.map((f) => f.best_life_years));
  const pos = (y: number) => `${((y - lo) / (hi - lo || 1)) * 100}%`;

  return (
    <div>
      <h3 className="text-sm font-semibold">What moves your estimate</h3>
      <p className="hint !mt-1 mb-4">
        Years gained or lost compared with an average person, and the full range each factor can span in this model.
      </p>
      <ul className="space-y-4">
        {factors.map((f) => {
          const note = factorNote(f, quitNow);
          const good = f.life_years >= 0;
          return (
            <li key={f.id} className="text-sm">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="font-medium">{f.label}</span>
                <span className={`font-semibold tabular-nums ${good ? "text-good" : "text-bad"}`}>{signed(f.life_years)}</span>
              </div>
              <div className="relative h-3" aria-hidden="true">
                <div className="absolute inset-y-1 inset-x-0 rounded-full bg-surface-2" />
                <div
                  className="absolute inset-y-1 rounded-full bg-[color-mix(in_srgb,var(--border-strong)_70%,transparent)]"
                  style={{ left: pos(f.worst_life_years), width: `calc(${pos(f.best_life_years)} - ${pos(f.worst_life_years)})` }}
                />
                <div
                  className={`absolute inset-y-1 rounded-full ${good ? "bg-good" : "bg-bad"}`}
                  style={good ? { left: pos(0), width: `calc(${pos(f.life_years)} - ${pos(0)})` } : { left: pos(f.life_years), width: `calc(${pos(0)} - ${pos(f.life_years)})` }}
                />
                <div className="absolute inset-y-0 w-px bg-faint" style={{ left: pos(0) }} />
                <div
                  className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${good ? "bg-good" : "bg-bad"}`}
                  style={{ left: pos(f.life_years) }}
                />
              </div>
              <div className="mt-1.5 flex justify-between gap-3 text-xs text-faint">
                <span>Worst {signed(f.worst_life_years)}</span>
                <span className={`text-right ${note.good ? "font-medium text-good" : "text-muted"}`}>{note.text}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="hint mt-4">
        Ranges hold your other answers fixed. Effects don&apos;t add up exactly because risks multiply, and these
        are associations from studies, not guarantees for any one person.
      </p>
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
