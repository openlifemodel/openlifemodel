import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { parse, stringify } from "yaml";
import olmSchema from "../../spec/olm-0.2.schema.json" with { type: "json" };
import profileSchema from "../../spec/person-profile-0.2.schema.json" with { type: "json" };
import type { Factor, InputInfo, OlmModel, PersonProfile } from "./types.ts";

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
const checkModelShape = ajv.compile<OlmModel>(olmSchema);
const checkProfileShape = ajv.compile<PersonProfile>(profileSchema);

export class OlmValidationError extends Error {
  readonly errors: string[];
  constructor(what: string, errors: string[]) {
    super(`Invalid ${what}:\n- ${errors.join("\n- ")}`);
    this.name = "OlmValidationError";
    this.errors = errors;
  }
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
}

// Prevalences may be rounded; accept a small total error.
const PREVALENCE_TOLERANCE = 0.011;

type ProfileProperty = { enum?: string[]; minimum?: number; maximum?: number };
const RESERVED = new Set(["age", "sex", "custom"]);

/** The standard PersonProfile inputs a factor may use, read from the profile schema. */
export const STANDARD_INPUTS: ReadonlyMap<string, InputInfo> = new Map(
  Object.entries(profileSchema.properties as Record<string, ProfileProperty>)
    .filter(([id]) => !RESERVED.has(id))
    .map(([id, prop]): [string, InputInfo] =>
      prop.enum
        ? [id, { id, standard: true, type: "choice", values: prop.enum }]
        : [id, { id, standard: true, type: "number", min: prop.minimum ?? -Infinity, max: prop.maximum ?? Infinity }],
    ),
);

/** What kind of value a factor input takes: a standard field or one of the model's custom inputs. */
export function inputInfo(model: OlmModel, id: string): InputInfo | undefined {
  const standard = STANDARD_INPUTS.get(id);
  if (standard) return standard;
  const custom = model.inputs?.find((i) => i.id === id);
  if (!custom) return undefined;
  return custom.type === "choice"
    ? { id, standard: false, type: "choice", values: (custom.choices ?? []).map((c) => c.value), declaration: custom }
    : { id, standard: false, type: "number", min: custom.min ?? -Infinity, max: custom.max ?? Infinity, declaration: custom };
}

/** Errors in a profile's answers to the model's custom inputs. */
export function customValueErrors(model: OlmModel, profile: PersonProfile): string[] {
  const errors: string[] = [];
  for (const [id, value] of Object.entries(profile.custom ?? {})) {
    const info = inputInfo(model, id);
    if (!info || info.standard) {
      errors.push(`custom answer "${id}" is not an input of this model`);
    } else if (info.type === "number") {
      if (typeof value !== "number" || value < info.min || value > info.max) {
        errors.push(`${info.declaration?.label ?? id} must be a number between ${info.min} and ${info.max}`);
      }
    } else if (typeof value !== "string" || !info.values.includes(value)) {
      errors.push(`${info.declaration?.label ?? id} must be one of: ${info.values.join(", ")}`);
    }
  }
  return errors;
}

function factorRules(model: OlmModel, factor: Factor, normalized: boolean, sourceIds: Set<string>): string[] {
  const where = `factor "${factor.id}"`;
  const errors: string[] = [];
  if (factor.source !== undefined && !sourceIds.has(factor.source)) {
    errors.push(`${where} cites unknown source "${factor.source}"`);
  }

  const entries = factor.type === "categorical" ? factor.levels : factor.bands;
  if (normalized) {
    if (entries.some((e) => e.prevalence === undefined)) {
      errors.push(`${where} needs a prevalence on every level or band for population-average normalization`);
    } else {
      const total = entries.reduce((sum, e) => sum + (e.prevalence ?? 0), 0);
      if (Math.abs(total - 1) > PREVALENCE_TOLERANCE) {
        errors.push(`${where} prevalences sum to ${total.toFixed(3)}, expected 1`);
      }
    }
  }

  const info = inputInfo(model, factor.input);
  if (!info) {
    errors.push(`${where} reads "${factor.input}", which is neither a standard input nor declared in inputs`);
    return errors;
  }
  if (factor.type === "categorical") {
    if (info.type !== "choice") {
      errors.push(`${where}: input "${factor.input}" is numeric, so the factor must be banded`);
      return errors;
    }
    const seen = new Set<string>();
    for (const level of factor.levels) {
      if (seen.has(level.value)) errors.push(`${where} lists level "${level.value}" twice`);
      seen.add(level.value);
    }
    for (const value of info.values) {
      if (!seen.has(value)) errors.push(`${where} has no level for "${value}"`);
    }
    for (const value of seen) {
      if (!info.values.includes(value)) errors.push(`${where} has unknown level "${value}"`);
    }
  } else {
    if (info.type !== "number") {
      errors.push(`${where}: input "${factor.input}" is a choice, so the factor must be categorical`);
      return errors;
    }
    const bands = factor.bands;
    bands.forEach((band, i) => {
      const first = i === 0;
      const last = i === bands.length - 1;
      if (first !== (band.min === undefined)) {
        errors.push(`${where} band ${i + 1}: only the first band may (and must) omit min`);
      }
      if (last !== (band.max === undefined)) {
        errors.push(`${where} band ${i + 1}: only the last band may (and must) omit max`);
      }
      if (band.min !== undefined && band.max !== undefined && band.min >= band.max) {
        errors.push(`${where} band ${i + 1}: min must be below max`);
      }
      const next = bands[i + 1];
      if (next !== undefined && band.max !== next.min) {
        errors.push(`${where} band ${i + 1}: max must equal the next band's min (no gaps or overlaps)`);
      }
    });
  }
  return errors;
}

/** Rules from OLM-SPEC.md that JSON Schema cannot express. */
function semanticErrors(model: OlmModel): string[] {
  const errors: string[] = [];
  const sourceIds = new Set(model.sources.map((s) => s.id));
  if (sourceIds.size !== model.sources.length) errors.push("source ids must be unique");
  if (!sourceIds.has(model.baseline.source)) {
    errors.push(`baseline cites unknown source "${model.baseline.source}"`);
  }

  const tables = Object.values(model.baseline.qx);
  const lengths = new Set(tables.map((t) => t.length));
  if (lengths.size > 1) errors.push("baseline qx tables must all have the same length");

  if (model.adjustment) {
    const normalized = model.adjustment.normalization === "population-average";
    const factorIds = new Set<string>();
    const inputs = new Set<string>();
    for (const factor of model.adjustment.factors) {
      if (factorIds.has(factor.id)) errors.push(`factor id "${factor.id}" is used twice`);
      if (inputs.has(factor.input)) errors.push(`input "${factor.input}" is used by more than one factor`);
      factorIds.add(factor.id);
      inputs.add(factor.input);
      errors.push(...factorRules(model, factor, normalized, sourceIds));
    }
  }

  const declared = new Set<string>();
  const used = new Set(model.adjustment?.factors.map((f) => f.input) ?? []);
  for (const input of model.inputs ?? []) {
    const where = `input "${input.id}"`;
    if (RESERVED.has(input.id) || STANDARD_INPUTS.has(input.id)) {
      errors.push(`${where} has the same id as a standard input; use the standard input instead`);
    }
    if (declared.has(input.id)) errors.push(`${where} is declared twice`);
    declared.add(input.id);
    if (!used.has(input.id)) errors.push(`${where} is declared but no factor uses it`);
    if (input.type === "number" && input.min !== undefined && input.max !== undefined && input.min >= input.max) {
      errors.push(`${where}: min must be below max`);
    }
    const values = (input.choices ?? []).map((c) => c.value);
    if (new Set(values).size !== values.length) errors.push(`${where} lists a choice twice`);
  }

  for (const test of model.tests ?? []) {
    const problems = profileErrors(test.profile);
    if (problems.length === 0) problems.push(...customValueErrors(model, test.profile));
    for (const e of problems) errors.push(`test "${test.name}": profile ${e}`);
  }
  return errors;
}

function profileErrors(profile: unknown): string[] {
  return checkProfileShape(profile) ? [] : formatAjvErrors(checkProfileShape.errors);
}

/** Validate an already-parsed model object. Throws OlmValidationError. */
export function validateModel(data: unknown): OlmModel {
  if (!checkModelShape(data)) {
    throw new OlmValidationError("model", formatAjvErrors(checkModelShape.errors));
  }
  const errors = semanticErrors(data);
  if (errors.length > 0) throw new OlmValidationError("model", errors);
  return data;
}

/** Validate a PersonProfile. Throws OlmValidationError. */
export function validateProfile(data: unknown): PersonProfile {
  const errors = profileErrors(data);
  if (errors.length > 0) throw new OlmValidationError("profile", errors);
  return data as PersonProfile;
}

const NOT_A_MODEL =
  "this is not an OLM model file. (Outlook for Mac also uses the .olm extension for mailbox archives.)";

/** Parse and validate the text of an OLM model file (.olm.yaml). Throws OlmValidationError. */
export function parseModel(text: string): OlmModel {
  // Binary files (such as Outlook archives) contain NUL characters; YAML never does.
  if (text.includes("\u0000")) throw new OlmValidationError("model", [NOT_A_MODEL]);
  let data: unknown;
  try {
    data = parse(text);
  } catch (err) {
    throw new OlmValidationError("model", [`not valid YAML: ${(err as Error).message}`]);
  }
  if (typeof data !== "object" || data === null || !("olm" in data)) {
    throw new OlmValidationError("model", [NOT_A_MODEL]);
  }
  return validateModel(data);
}

/** Serialize a model back to OLM model file (YAML) text. */
export function serializeModel(model: OlmModel): string {
  return stringify(model, { lineWidth: 100, flowCollectionPadding: false });
}
