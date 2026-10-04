import {
  OlmValidationError,
  STANDARD_INPUTS,
  inputInfo,
  validateModel,
  type CustomInput,
  type Factor,
  type OlmModel,
} from "@openlifemodel/engine";

// Helpers for the in-browser model editor. Everything here is pure: it takes
// a model and returns a new one, so React state stays simple.

export type EditorTab = "overview" | "factors" | "questions" | "sources" | "file";

export interface Problem {
  tab: EditorTab;
  message: string;
}

export const LICENSES = [
  { id: "CC-BY-4.0", label: "CC BY 4.0 (credit required)" },
  { id: "CC0-1.0", label: "CC0 1.0 (public domain)" },
  { id: "CC-BY-SA-4.0", label: "CC BY-SA 4.0 (credit, share alike)" },
  { id: "CC-BY-NC-4.0", label: "CC BY-NC 4.0 (non-commercial)" },
  { id: "Apache-2.0", label: "Apache 2.0" },
  { id: "MIT", label: "MIT" },
] as const;

/** Lowercase identifier from free text, e.g. "Air pollution" -> "air-pollution". */
export function slugify(text: string, separator: "-" | "_" = "-"): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, separator)
      .replace(new RegExp(`^\\${separator}+|\\${separator}+$`, "g"), "")
      .slice(0, 40) || "item"
  );
}

function uniqueId(base: string, taken: Iterable<string>, separator: "-" | "_" = "-"): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}${separator}${i}`)) return `${base}${separator}${i}`;
}

/** The first time a bundled model is edited it becomes a clearly named copy. */
export function editedCopy(model: OlmModel): OlmModel {
  const copy = structuredClone(model);
  copy.id = `${model.id}-custom`;
  copy.name = `${model.name} (edited)`.slice(0, 200);
  copy.version = `${model.version.split("-")[0]}-custom`;
  if (copy.status === "published") copy.status = "experimental";
  // Reference tests describe the original numbers.
  delete copy.tests;
  return copy;
}

/** Inputs a new factor could use: standard ones and the model's own, minus those already used. */
export function availableInputs(model: OlmModel): { id: string; label: string }[] {
  const used = new Set(model.adjustment?.factors.map((f) => f.input) ?? []);
  const standard = [...STANDARD_INPUTS.keys()].map((id) => ({ id, label: STANDARD_LABELS[id] ?? id }));
  const custom = (model.inputs ?? []).map((i) => ({ id: i.id, label: `${i.label} (this model's question)` }));
  return [...standard, ...custom].filter((i) => !used.has(i.id));
}

export const STANDARD_LABELS: Record<string, string> = {
  smoking_status: "Smoking",
  bmi: "Body mass index",
  systolic_bp: "Systolic blood pressure",
  mvpa_minutes_per_week: "Exercise",
  alcohol_drinks_per_week: "Alcohol",
};

/** A new factor for an input, with neutral hazard ratios and equal population shares. */
export function newFactor(model: OlmModel, input: string): Factor {
  const info = inputInfo(model, input);
  const label = (STANDARD_LABELS[input] ?? model.inputs?.find((i) => i.id === input)?.label ?? input).slice(0, 40);
  const id = uniqueId(slugify(label), model.adjustment?.factors.map((f) => f.id) ?? []);
  const source = model.sources[0]?.id;
  const base = { id, label, input, missing: "neutral" as const, ...(source && { source }) };
  if (info?.type === "choice") {
    const share = round3(1 / info.values.length);
    return { ...base, type: "categorical", levels: info.values.map((value) => ({ value, hazard_ratio: 1, prevalence: share })) };
  }
  const lo = info && Number.isFinite(info.min) ? info.min : 0;
  const hi = info && Number.isFinite(info.max) ? info.max : 100;
  const mid = round3(lo + (hi - lo) / 2);
  return {
    ...base,
    type: "banded",
    bands: [
      { max: mid, hazard_ratio: 1, prevalence: 0.5 },
      { min: mid, hazard_ratio: 1, prevalence: 0.5 },
    ],
  };
}

export function newCustomInput(model: OlmModel, type: "number" | "choice"): CustomInput {
  const taken = [...STANDARD_INPUTS.keys(), ...(model.inputs?.map((i) => i.id) ?? [])];
  const id = uniqueId(type === "number" ? "new_number" : "new_choice", taken, "_");
  return type === "number"
    ? { id, label: "New question", type, unit: "units", min: 0, max: 100 }
    : {
        id,
        label: "New question",
        type,
        choices: [
          { value: "option_a", label: "Option A" },
          { value: "option_b", label: "Option B" },
        ],
      };
}

/** Keep a categorical factor's levels in step with its input's choices. */
export function syncLevels(model: OlmModel): OlmModel {
  const next = structuredClone(model);
  for (const factor of next.adjustment?.factors ?? []) {
    const info = inputInfo(next, factor.input);
    if (factor.type !== "categorical" || info?.type !== "choice") continue;
    const existing = new Map(factor.levels.map((l) => [l.value, l]));
    factor.levels = info.values.map((value) => existing.get(value) ?? { value, hazard_ratio: 1, prevalence: 0 });
  }
  return next;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Rescale a factor's population shares so they add up to exactly 1. */
export function normalizeShares(factor: Factor): Factor {
  const entries = factor.type === "categorical" ? factor.levels : factor.bands;
  const total = entries.reduce((sum, e) => sum + (e.prevalence ?? 0), 0);
  const scaled = entries.map((e) => ({
    ...e,
    prevalence: total > 0 ? round3((e.prevalence ?? 0) / total) : round3(1 / entries.length),
  }));
  // Put any rounding remainder on the largest share.
  const drift = round3(1 - scaled.reduce((sum, e) => sum + e.prevalence, 0));
  const largest = scaled.reduce((best, e, i) => (e.prevalence > (scaled[best]?.prevalence ?? -1) ? i : best), 0);
  if (scaled[largest]) scaled[largest].prevalence = round3(scaled[largest].prevalence + drift);
  return factor.type === "categorical"
    ? { ...factor, levels: scaled as typeof factor.levels }
    : { ...factor, bands: scaled as typeof factor.bands };
}

// Which tab a validation message belongs to: schema paths first, then the
// wording of the engine's own rule messages (see engine/src/validate.ts).
const TAB_RULES: [RegExp, EditorTab][] = [
  [/^\/adjustment/, "factors"],
  [/^\/inputs/, "questions"],
  [/^\/(sources|assumptions)/, "sources"],
  [/^\/(tests|baseline)/, "file"],
  [/^\//, "overview"],
  [/^factor |^input "[^"]+" is used by more than one factor/, "factors"],
  [/^input "/, "questions"],
  [/^source |^baseline cites/, "sources"],
  [/^test |^baseline /, "file"],
];

function tabFor(message: string): EditorTab {
  return TAB_RULES.find(([pattern]) => pattern.test(message))?.[1] ?? "overview";
}

/** Rewrite a schema path such as /adjustment/factors/1/bands/2/max into words. */
function describePath(model: OlmModel, path: string): string {
  const parts = path.split("/").filter(Boolean);
  const words: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] as string;
    const next = Number(parts[i + 1]);
    if (part === "factors" && Number.isInteger(next)) {
      words.push(`Risk factor "${model.adjustment?.factors[next]?.label ?? next + 1}"`);
      i++;
    } else if ((part === "bands" || part === "levels") && Number.isInteger(next)) {
      words.push(`${part === "bands" ? "band" : "level"} ${next + 1}`);
      i++;
    } else if (part === "inputs" && Number.isInteger(next)) {
      words.push(`Question "${model.inputs?.[next]?.label ?? next + 1}"`);
      i++;
    } else if (part === "sources" && Number.isInteger(next)) {
      words.push(`Source ${next + 1}`);
      i++;
    } else if (part === "authors" && Number.isInteger(next)) {
      words.push(`Author ${next + 1}`);
      i++;
    } else if (part !== "adjustment") {
      words.push(part.replace(/_/g, " "));
    }
  }
  return words.join(", ");
}

/** Reword the engine's rule messages with the labels people see in the editor. */
function plainRule(model: OlmModel, message: string): string {
  const label = (id: string) => model.adjustment?.factors.find((f) => f.id === id)?.label ?? id;
  const shares = /^factor "([^"]+)" prevalences sum to ([\d.]+), expected 1$/.exec(message);
  if (shares) {
    const pct = Math.round(Number(shares[2]) * 1000) / 10;
    return `${label(shares[1] ?? "")}: population shares add up to ${pct}%; they should add up to 100%.`;
  }
  const text = message
    .replace(/^factor "([^"]+)"/, (_, id: string) => label(id))
    .replace(/^input "([^"]+)"/, (_, id: string) => `Question "${model.inputs?.find((i) => i.id === id)?.label ?? id}"`)
    .replace(/prevalence/g, "population share");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Validate a draft and return plain-language problems, each pointing at an editor tab. */
export function findProblems(model: OlmModel): Problem[] {
  try {
    validateModel(structuredClone(model));
    return [];
  } catch (err) {
    const errors = err instanceof OlmValidationError ? err.errors : [String(err)];
    return errors.map((message) => {
      const match = /^(\/\S*) (.*)$/.exec(message);
      if (!match) return { tab: tabFor(message), message: plainRule(model, message) };
      const [, path = "", rest = ""] = match;
      const where = describePath(model, path);
      return { tab: tabFor(path), message: where ? `${where}: ${rest}` : rest };
    });
  }
}
