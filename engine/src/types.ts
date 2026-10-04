// TypeScript shapes for OLM 0.1. The JSON Schemas in /spec are authoritative;
// these types mirror them for use inside the engine.

export type Sex = "male" | "female";

export interface PersonProfile {
  age: number;
  sex?: Sex;
  smoking_status?:
    | "never"
    | "former_quit_before_35"
    | "former_quit_35_44"
    | "former_quit_45_54"
    | "former_quit_55_plus"
    | "former"
    | "current";
  bmi?: number;
  systolic_bp?: number;
  mvpa_minutes_per_week?: number;
  alcohol_drinks_per_week?: number;
  /** Answers to custom inputs declared by a model, keyed by input id. */
  custom?: Record<string, number | string>;
}

/** A standard PersonProfile field that factors may read. */
export type StandardInput = Exclude<keyof PersonProfile, "age" | "sex" | "custom">;
/** A standard input, or the id of a custom input declared by the model. */
export type FactorInput = string;

export interface CustomInput {
  id: string;
  label: string;
  question?: string;
  help?: string;
  type: "number" | "choice";
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  choices?: { value: string; label: string }[];
}

/** Resolved description of an input, standard or custom. */
export type InputInfo =
  | { id: string; standard: boolean; type: "number"; min: number; max: number; declaration?: CustomInput }
  | { id: string; standard: boolean; type: "choice"; values: string[]; declaration?: CustomInput };

export interface Source {
  id: string;
  citation: string;
  doi?: string;
  url?: string;
  license?: string;
  notes?: string;
}

export interface CategoricalLevel {
  value: string;
  hazard_ratio: number;
  prevalence?: number;
}

export interface Band {
  min?: number;
  max?: number;
  hazard_ratio: number;
  prevalence?: number;
}

interface FactorBase {
  id: string;
  label: string;
  input: FactorInput;
  missing: "neutral" | "required";
  source?: string;
  notes?: string;
}

export interface CategoricalFactor extends FactorBase {
  type: "categorical";
  levels: CategoricalLevel[];
}

export interface BandedFactor extends FactorBase {
  type: "banded";
  bands: Band[];
}

export type Factor = CategoricalFactor | BandedFactor;

export interface Expectation {
  value: number;
  tolerance: number;
}

export type ExpectedOutput =
  | "remaining_life_expectancy"
  | "median_age_at_death"
  | "equivalent_age"
  | "survival_to_80"
  | "survival_to_90"
  | "survival_to_100"
  | "combined_hazard_ratio";

export interface ModelTest {
  name: string;
  origin?: "published" | "reference-engine";
  profile: PersonProfile;
  expect: Partial<Record<ExpectedOutput, Expectation>>;
}

export interface OlmModel {
  olm: "0.1" | "0.2";
  id: string;
  name: string;
  version: string;
  status: "illustrative" | "experimental" | "published";
  license: string;
  authors: { name: string; url?: string; orcid?: string }[];
  description: string;
  population?: string;
  assumptions?: string[];
  sources: Source[];
  inputs?: CustomInput[];
  baseline: {
    type: "period-life-table";
    source: string;
    /** ISO 3166-1 alpha-2 code of the table's population, e.g. "US". */
    region?: string;
    start_age: number;
    /** Life tables by sex, and/or "all" for both sexes combined. */
    qx: Partial<Record<Sex | "all", number[]>>;
  };
  adjustment?: {
    method: "proportional-hazards";
    normalization: "population-average" | "none";
    factors: Factor[];
  };
  tests?: ModelTest[];
}

export interface FactorResult {
  id: string;
  label: string;
  input: FactorInput;
  /** The profile value used, or null when missing. */
  value: string | number | null;
  /** Hazard ratio after normalization; 1 means no effect relative to the baseline. */
  hazard_ratio: number;
  /** Remaining life expectancy with this factor minus without it (factor set to 1). */
  life_years: number;
  /** The most favourable life_years any level of this factor could give, other answers unchanged. */
  best_life_years: number;
  /** The least favourable life_years any level of this factor could give, other answers unchanged. */
  worst_life_years: number;
  /** The level(s) giving best_life_years: a categorical value, or a band's bounds. */
  best_levels: FactorLevel[];
}

export type FactorLevel = string | { min?: number; max?: number };

export interface SurvivalPoint {
  age: number;
  survival: number;
}

export interface CalculationResult {
  model: { id: string; version: string };
  age: number;
  remaining_life_expectancy: number;
  expected_age_at_death: number;
  median_age_at_death: number;
  /** Age at which an average person of the same sex has the same remaining life expectancy. */
  equivalent_age: number;
  /** Probability of surviving from the current age to the given age; null if already past it. */
  survival_to: Record<80 | 90 | 100, number | null>;
  combined_hazard_ratio: number;
  survival_curve: SurvivalPoint[];
  factors: FactorResult[];
  warnings: string[];
}
