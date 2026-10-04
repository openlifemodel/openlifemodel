import type {
  CalculationResult,
  Factor,
  FactorLevel,
  FactorResult,
  OlmModel,
  PersonProfile,
  SurvivalPoint,
} from "./types.ts";
import { customValueErrors, OlmValidationError, STANDARD_INPUTS, validateProfile } from "./validate.ts";

// The method is described in spec/OLM-SPEC.md ("Calculation"). In short:
// each life-table year has a constant force of mortality mu = -ln(1 - qx),
// the person's force is mu * HR, and life expectancy is the exact integral of
// the resulting piecewise-exponential survival curve. After the last table
// age the final year's force continues indefinitely.

const MILESTONES = [80, 90, 100] as const;

function forces(qx: number[]): number[] {
  return qx.map((q) => -Math.log1p(-q));
}

/** Expected years lived in one year of constant force `m` by someone alive at its start. */
function yearFraction(m: number): number {
  return m < 1e-12 ? 1 : -Math.expm1(-m) / m;
}

interface Projection {
  remaining: number;
  medianAge: number;
  curve: SurvivalPoint[];
}

function project(mu: number[], startAge: number, age: number, hr: number): Projection {
  const lastIndex = mu.length - 1;
  const curve: SurvivalPoint[] = [{ age, survival: 1 }];
  let survival = 1;
  let remaining = 0;
  let medianAge = Number.NaN;
  for (let i = age - startAge; i <= lastIndex; i++) {
    const m = (mu[i] as number) * hr;
    const yearStart = startAge + i;
    remaining += survival * yearFraction(m);
    const next = survival * Math.exp(-m);
    if (Number.isNaN(medianAge) && next <= 0.5) {
      medianAge = yearStart + Math.log(survival / 0.5) / m;
    }
    survival = next;
    curve.push({ age: yearStart + 1, survival });
  }
  // Tail beyond the table: constant final force.
  const tail = (mu[lastIndex] as number) * hr;
  const endAge = startAge + lastIndex + 1;
  remaining += survival / tail;
  if (Number.isNaN(medianAge)) medianAge = endAge + Math.log(survival / 0.5) / tail;
  return { remaining, medianAge, curve };
}

function survivalAt(curve: SurvivalPoint[], targetAge: number, tailForce: number): number | null {
  const first = curve[0] as SurvivalPoint;
  if (targetAge <= first.age) return null;
  const point = curve.find((p) => p.age === targetAge);
  if (point) return point.survival;
  const last = curve[curve.length - 1] as SurvivalPoint;
  return last.survival * Math.exp(-tailForce * (targetAge - last.age));
}

function rawHazardRatio(factor: Factor, value: string | number): number {
  if (factor.type === "categorical") {
    const level = factor.levels.find((l) => l.value === value);
    if (!level) throw new OlmValidationError("profile", [`no level "${value}" in factor "${factor.id}"`]);
    return level.hazard_ratio;
  }
  const x = value as number;
  const band = factor.bands.find(
    (b) => (b.min === undefined || x >= b.min) && (b.max === undefined || x < b.max),
  ) as (typeof factor.bands)[number];
  return band.hazard_ratio;
}

/** Every level of a factor with its raw hazard ratio. */
function levelsOf(factor: Factor): { level: FactorLevel; hr: number }[] {
  return factor.type === "categorical"
    ? factor.levels.map((l) => ({ level: l.value, hr: l.hazard_ratio }))
    : factor.bands.map((b) => ({
        level: { ...(b.min !== undefined && { min: b.min }), ...(b.max !== undefined && { max: b.max }) },
        hr: b.hazard_ratio,
      }));
}

function populationMean(factor: Factor): number {
  const entries = factor.type === "categorical" ? factor.levels : factor.bands;
  return entries.reduce((sum, e) => sum + (e.prevalence ?? 0) * e.hazard_ratio, 0);
}

// Average remaining life expectancy at each age of a table, cached per table.
const baselineCache = new WeakMap<number[], number[]>();

function baselineExpectancies(qx: number[], mu: number[], startAge: number): number[] {
  let table = baselineCache.get(qx);
  if (!table) {
    table = mu.map((_, i) => project(mu, startAge, startAge + i, 1).remaining);
    baselineCache.set(qx, table);
  }
  return table;
}

/**
 * Equivalent age: the age at which an average person of the same sex, under
 * the same baseline, has the same remaining life expectancy (spec section 6).
 * Interpolated linearly between whole ages; clamped to the table's ages.
 */
function equivalentAge(baseline: number[], startAge: number, remaining: number): number {
  if (remaining >= (baseline[0] as number)) return startAge;
  for (let i = 0; i < baseline.length - 1; i++) {
    const here = baseline[i] as number;
    const next = baseline[i + 1] as number;
    if (here >= remaining && remaining > next) return startAge + i + (here - remaining) / (here - next);
  }
  return startAge + baseline.length - 1;
}

/** A factor's input value: a standard profile field, or an answer to a custom input. */
function readInput(profile: PersonProfile, input: string): string | number | null {
  if (STANDARD_INPUTS.has(input)) return (profile[input as keyof PersonProfile] as string | number | undefined) ?? null;
  return profile.custom?.[input] ?? null;
}

/** Run a model against a profile. Throws OlmValidationError for invalid or unsupported profiles. */
export function calculate(model: OlmModel, input: unknown): CalculationResult {
  const profile: PersonProfile = validateProfile(input);
  const customErrors = customValueErrors(model, profile);
  if (customErrors.length > 0) throw new OlmValidationError("profile", customErrors);
  const { start_age: startAge } = model.baseline;
  const qx = model.baseline.qx[profile.sex];
  if (!qx) throw new OlmValidationError("profile", [`model "${model.id}" has no baseline for sex "${profile.sex}"`]);
  if (profile.age < startAge || profile.age > startAge + qx.length - 1) {
    throw new OlmValidationError("profile", [
      `age ${profile.age} is outside the model's table (${startAge}–${startAge + qx.length - 1})`,
    ]);
  }

  const warnings: string[] = [];
  const adjustment = model.adjustment;
  const factorHrs: { factor: Factor; value: string | number | null; hr: number }[] = [];
  for (const factor of adjustment?.factors ?? []) {
    const value = readInput(profile, factor.input);
    if (value === null) {
      if (factor.missing === "required") {
        throw new OlmValidationError("profile", [`"${factor.input}" is required by this model`]);
      }
      warnings.push(`${factor.label}: not provided, treated as population average.`);
      factorHrs.push({ factor, value, hr: 1 });
      continue;
    }
    const raw = rawHazardRatio(factor, value);
    const hr = adjustment?.normalization === "population-average" ? raw / populationMean(factor) : raw;
    factorHrs.push({ factor, value, hr });
  }

  const mu = forces(qx);
  const combined = factorHrs.reduce((product, f) => product * f.hr, 1);
  const full = project(mu, startAge, profile.age, combined);
  const tailForce = (mu[mu.length - 1] as number) * combined;

  const factors: FactorResult[] = factorHrs.map(({ factor, value, hr }) => {
    const others = combined / hr;
    const without = project(mu, startAge, profile.age, others).remaining;
    // What each level of this factor would give, holding the other answers fixed.
    const scale = adjustment?.normalization === "population-average" ? populationMean(factor) : 1;
    const options = levelsOf(factor).map(({ level, hr: raw }) => ({
      level,
      hr: raw / scale,
      years: project(mu, startAge, profile.age, others * (raw / scale)).remaining - without,
    }));
    const lowestHr = Math.min(...options.map((o) => o.hr));
    return {
      id: factor.id,
      label: factor.label,
      input: factor.input,
      value,
      hazard_ratio: hr,
      life_years: full.remaining - without,
      best_life_years: Math.max(...options.map((o) => o.years)),
      worst_life_years: Math.min(...options.map((o) => o.years)),
      best_levels: options.filter((o) => o.hr <= lowestHr * (1 + 1e-12)).map((o) => o.level),
    };
  });

  const survivalTo = Object.fromEntries(
    MILESTONES.map((m) => [m, survivalAt(full.curve, m, tailForce)]),
  ) as CalculationResult["survival_to"];

  return {
    model: { id: model.id, version: model.version },
    age: profile.age,
    remaining_life_expectancy: full.remaining,
    expected_age_at_death: profile.age + full.remaining,
    median_age_at_death: full.medianAge,
    equivalent_age: equivalentAge(baselineExpectancies(qx, mu, startAge), startAge, full.remaining),
    survival_to: survivalTo,
    combined_hazard_ratio: combined,
    survival_curve: full.curve,
    factors,
    warnings,
  };
}
