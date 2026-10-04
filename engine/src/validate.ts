import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { parse, stringify } from "yaml";
import olmSchema from "../../spec/olm-0.1.schema.json" with { type: "json" };
import profileSchema from "../../spec/person-profile-0.1.schema.json" with { type: "json" };
import type { Factor, OlmModel, PersonProfile } from "./types.ts";

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

function factorRules(factor: Factor, normalized: boolean, sourceIds: Set<string>): string[] {
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

  if (factor.type === "categorical") {
    if (factor.input !== "smoking_status") {
      errors.push(`${where}: input "${factor.input}" is numeric, so the factor must be banded`);
    }
    const allowed = (profileSchema.properties.smoking_status.enum as string[]);
    const seen = new Set<string>();
    for (const level of factor.levels) {
      if (seen.has(level.value)) errors.push(`${where} lists level "${level.value}" twice`);
      seen.add(level.value);
    }
    for (const value of allowed) {
      if (!seen.has(value)) errors.push(`${where} has no level for "${value}"`);
    }
    for (const value of seen) {
      if (!allowed.includes(value)) errors.push(`${where} has unknown level "${value}"`);
    }
  } else {
    if (factor.input === "smoking_status") {
      errors.push(`${where}: input "smoking_status" is categorical, so the factor must be categorical`);
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
      errors.push(...factorRules(factor, normalized, sourceIds));
    }
  }

  for (const test of model.tests ?? []) {
    for (const e of profileErrors(test.profile)) errors.push(`test "${test.name}": profile ${e}`);
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

/** Parse and validate the text of a .olm file (YAML). Throws OlmValidationError. */
export function parseModel(text: string): OlmModel {
  let data: unknown;
  try {
    data = parse(text);
  } catch (err) {
    throw new OlmValidationError("model", [`not valid YAML: ${(err as Error).message}`]);
  }
  return validateModel(data);
}

/** Serialize a model back to .olm (YAML) text. */
export function serializeModel(model: OlmModel): string {
  return stringify(model, { lineWidth: 100, flowCollectionPadding: false });
}
