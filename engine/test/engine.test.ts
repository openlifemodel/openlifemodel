import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculate,
  OlmValidationError,
  parseModel,
  runReferenceTests,
  serializeModel,
  validateModel,
  type OlmModel,
} from "../src/index.ts";

const modelsDir = new URL("../../models/", import.meta.url);
const modelFiles = readdirSync(modelsDir).filter((f) => f.endsWith(".olm.yaml"));
const fixturesDir = new URL("./fixtures/", import.meta.url);
const load = (file: string, dir: URL = modelsDir): OlmModel => parseModel(readFileSync(new URL(file, dir), "utf8"));

describe("bundled models", () => {
  it("finds the example models", () => {
    expect(modelFiles).toContain("us-ssa-2023-period.olm.yaml");
    expect(modelFiles).toContain("us-lifestyle.olm.yaml");
  });

  describe.each(modelFiles)("%s", (file) => {
    const model = load(file);

    it("has reference tests", () => {
      expect(model.tests?.length ?? 0).toBeGreaterThan(0);
    });

    it("passes its own reference tests", () => {
      const failures = runReferenceTests(model).filter((c) => !c.passed);
      expect(failures).toEqual([]);
    });

    it("round-trips through serialization", () => {
      expect(parseModel(serializeModel(model))).toEqual(model);
    });
  });
});

describe("illustrative fixture", () => {
  it("passes its own reference tests", () => {
    const failures = runReferenceTests(load("illustrative-lifestyle.olm.yaml", fixturesDir)).filter((c) => !c.passed);
    expect(failures).toEqual([]);
  });
});

describe("calculate", () => {
  const baseline = load("us-ssa-2023-period.olm.yaml");
  const lifestyle = load("illustrative-lifestyle.olm.yaml", fixturesDir);

  it("returns a survival curve starting at 1 and decreasing", () => {
    const result = calculate(baseline, { age: 30, sex: "female" });
    const curve = result.survival_curve;
    expect(curve[0]).toEqual({ age: 30, survival: 1 });
    expect(curve.at(-1)?.age).toBe(120);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.survival).toBeLessThanOrEqual(curve[i - 1]!.survival);
    }
  });

  it("puts the median age where survival crosses one half", () => {
    const result = calculate(baseline, { age: 50, sex: "male" });
    const before = result.survival_curve.filter((p) => p.age <= result.median_age_at_death);
    const after = result.survival_curve.filter((p) => p.age > result.median_age_at_death);
    expect(before.at(-1)!.survival).toBeGreaterThan(0.5);
    expect(after[0]!.survival).toBeLessThanOrEqual(0.5);
  });

  it("gives an average person an equivalent age equal to their age", () => {
    for (const age of [0, 25, 40, 77, 119]) {
      expect(calculate(baseline, { age, sex: "female" }).equivalent_age).toBeCloseTo(age, 6);
    }
  });

  it("lowers equivalent age for favourable profiles and raises it for unfavourable ones", () => {
    const never = calculate(lifestyle, { age: 50, sex: "male", smoking_status: "never", bmi: 22 });
    const current = calculate(lifestyle, { age: 50, sex: "male", smoking_status: "current", bmi: 36 });
    expect(never.equivalent_age).toBeLessThan(50);
    expect(current.equivalent_age).toBeGreaterThan(50);
    // Same remaining life expectancy as an average person at the equivalent age.
    const avgAtEquivalent = calculate(baseline, { age: Math.floor(current.equivalent_age), sex: "male" });
    expect(avgAtEquivalent.remaining_life_expectancy).toBeGreaterThanOrEqual(current.remaining_life_expectancy);
  });

  it("clamps equivalent age to the table", () => {
    const young = calculate(lifestyle, { age: 0, sex: "female", smoking_status: "never", bmi: 22, systolic_bp: 110, mvpa_minutes_per_week: 300 });
    expect(young.equivalent_age).toBe(0);
  });

  it("reports survival milestones already passed as null", () => {
    const result = calculate(baseline, { age: 85, sex: "female" });
    expect(result.survival_to[80]).toBeNull();
    expect(result.survival_to[90]).toBeGreaterThan(0);
  });

  it("raises life expectancy when hazard falls", () => {
    const never = calculate(lifestyle, { age: 50, sex: "male", smoking_status: "never" });
    const current = calculate(lifestyle, { age: 50, sex: "male", smoking_status: "current" });
    expect(never.remaining_life_expectancy).toBeGreaterThan(current.remaining_life_expectancy);
    expect(never.factors.find((f) => f.id === "smoking")!.life_years).toBeGreaterThan(0);
    expect(current.factors.find((f) => f.id === "smoking")!.life_years).toBeLessThan(0);
  });

  it("treats a population-average mix as the baseline", () => {
    // Prevalence-weighted normalized hazard ratios average to exactly 1.
    const smoking = lifestyle.adjustment!.factors.find((f) => f.id === "smoking")!;
    const levels = smoking.type === "categorical" ? smoking.levels : [];
    const mean = levels.reduce((s, l) => s + l.prevalence! * l.hazard_ratio, 0);
    const weighted = levels.reduce((s, l) => {
      const r = calculate(lifestyle, { age: 40, sex: "male", smoking_status: l.value as "never" });
      return s + l.prevalence! * r.combined_hazard_ratio;
    }, 0);
    expect(weighted).toBeCloseTo(1, 10);
    expect(mean).toBeGreaterThan(1);
  });

  it("reports each factor's best and worst possible contribution", () => {
    const never = calculate(lifestyle, { age: 50, sex: "male", smoking_status: "never" });
    const smoking = never.factors.find((f) => f.id === "smoking")!;
    expect(smoking.best_life_years).toBeCloseTo(smoking.life_years, 10);
    expect(smoking.best_levels).toEqual(["never"]);
    expect(smoking.worst_life_years).toBeLessThan(0);

    const current = calculate(lifestyle, { age: 50, sex: "male", smoking_status: "current" });
    const s2 = current.factors.find((f) => f.id === "smoking")!;
    expect(s2.worst_life_years).toBeCloseTo(s2.life_years, 10);
    expect(s2.best_life_years).toBeCloseTo(smoking.best_life_years, 1);

    const bmi = calculate(lifestyle, { age: 50, sex: "male", bmi: 27 }).factors.find((f) => f.id === "bmi")!;
    expect(bmi.best_levels).toEqual([{ min: 18.5, max: 25 }]);
    expect(bmi.best_life_years).toBeGreaterThan(bmi.life_years);
  });

  it("uses [min, max) band boundaries", () => {
    const at25 = calculate(lifestyle, { age: 40, sex: "male", bmi: 25 });
    const below = calculate(lifestyle, { age: 40, sex: "male", bmi: 24.99 });
    expect(at25.combined_hazard_ratio).toBeGreaterThan(below.combined_hazard_ratio);
  });

  it("warns about missing inputs treated as neutral", () => {
    const result = calculate(lifestyle, { age: 40, sex: "male", bmi: 22 });
    expect(result.warnings).toHaveLength(3);
  });

  it("needs sex when a model only has tables by sex", () => {
    expect(() => calculate(baseline, { age: 40 })).toThrow(/sex is required by this model/);
  });

  it("uses a combined table when sex is not given", () => {
    const combined: OlmModel = structuredClone(baseline);
    combined.baseline.qx = { ...combined.baseline.qx, all: combined.baseline.qx.female! };
    validateModel(structuredClone(combined));
    const anyone = calculate(combined, { age: 40 });
    const woman = calculate(combined, { age: 40, sex: "female" });
    const man = calculate(combined, { age: 40, sex: "male" });
    expect(anyone.remaining_life_expectancy).toBeCloseTo(woman.remaining_life_expectancy, 10);
    expect(man.remaining_life_expectancy).toBeLessThan(woman.remaining_life_expectancy);
    expect(anyone.equivalent_age).toBeCloseTo(40, 6);

    const allOnly: OlmModel = structuredClone(combined);
    allOnly.baseline.qx = { all: combined.baseline.qx.all! };
    // With only a combined table, a stated sex still uses it.
    expect(calculate(validateModel(allOnly), { age: 40, sex: "male" }).remaining_life_expectancy).toBeCloseTo(
      anyone.remaining_life_expectancy,
      10,
    );
  });

  it("rejects invalid profiles", () => {
    expect(() => calculate(baseline, {})).toThrow(OlmValidationError);
    expect(() => calculate(baseline, { age: 40, sex: "male", bmi: 500 })).toThrow(OlmValidationError);
    expect(() => calculate(baseline, { age: 40, sex: "male", height: 180 })).toThrow(OlmValidationError);
  });
});

describe("validation", () => {
  const text = readFileSync(new URL("illustrative-lifestyle.olm.yaml", fixturesDir), "utf8");
  const base = (): OlmModel => structuredClone(parseModel(text));
  const errorsFor = (model: unknown): string[] => {
    try {
      parseModel(serializeModel(model as OlmModel));
      return [];
    } catch (err) {
      return (err as OlmValidationError).errors;
    }
  };

  it("rejects binary files such as Outlook archives", () => {
    expect(() => parseModel("PK\u0003\u0004\u0000\u0000binary")).toThrow(/not an OLM model file/);
  });

  it("rejects YAML that is not an OLM model", () => {
    expect(() => parseModel("name: my shopping list\nitems: [eggs]")).toThrow(/not an OLM model file/);
    expect(() => parseModel("just a sentence")).toThrow(/not an OLM model file/);
  });

  it("rejects text that is not YAML", () => {
    expect(() => parseModel("olm: [unclosed")).toThrow(/not valid YAML/);
  });

  it("rejects an unknown OLM version", () => {
    const model = { ...base(), olm: "9.9" };
    expect(errorsFor(model).join()).toMatch(/olm/);
  });

  it("requires prevalences to sum to 1 when normalizing", () => {
    const model = base();
    const factor = model.adjustment!.factors[0]!;
    if (factor.type === "categorical") factor.levels[0]!.prevalence = 0.9;
    expect(errorsFor(model).join()).toMatch(/prevalences sum to/);
  });

  it("rejects gaps between bands", () => {
    const model = base();
    const factor = model.adjustment!.factors[1]!;
    if (factor.type === "banded") factor.bands[1]!.max = 24;
    expect(errorsFor(model).join()).toMatch(/no gaps or overlaps/);
  });

  it("rejects references to unknown sources", () => {
    const model = base();
    model.adjustment!.factors[0]!.source = "nowhere";
    expect(errorsFor(model).join()).toMatch(/unknown source "nowhere"/);
  });

  it("rejects baseline tables of different lengths", () => {
    const model = base();
    model.baseline.qx.female = model.baseline.qx.female!.slice(0, 50);
    expect(errorsFor(model).join()).toMatch(/same length/);
  });

  it("rejects a categorical factor missing a level", () => {
    const model = base();
    const factor = model.adjustment!.factors[0]!;
    if (factor.type === "categorical") factor.levels = factor.levels.filter((l) => l.value !== "current");
    expect(errorsFor(model).join()).toMatch(/no level for "current"/);
  });
});

describe("spec examples", () => {
  const examplesDir = new URL("../../spec/examples/", import.meta.url);
  it.each(readdirSync(examplesDir).filter((f) => f.endsWith(".olm.yaml")))("%s is a valid model", (file) => {
    const model = load(file, examplesDir);
    expect(model.inputs?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("custom inputs (OLM 0.2)", () => {
  const ssa = load("us-ssa-2023-period.olm.yaml");
  const withCustom = (): OlmModel => ({
    ...structuredClone(ssa),
    olm: "0.2",
    id: "pollution-example",
    tests: [],
    sources: [...ssa.sources, { id: "example", citation: "Example values for tests." }],
    inputs: [
      { id: "pm25", label: "Air pollution", question: "Average PM2.5 where you live", type: "number", unit: "µg/m³", min: 0, max: 200 },
      {
        id: "commute",
        label: "Commute",
        type: "choice",
        choices: [
          { value: "car", label: "Car" },
          { value: "active", label: "Walk or cycle" },
        ],
      },
    ],
    adjustment: {
      method: "proportional-hazards",
      normalization: "population-average",
      factors: [
        {
          id: "pm25",
          label: "Air pollution",
          input: "pm25",
          type: "banded",
          missing: "neutral",
          source: "example",
          bands: [
            { max: 10, hazard_ratio: 1, prevalence: 0.6 },
            { min: 10, hazard_ratio: 1.1, prevalence: 0.4 },
          ],
        },
        {
          id: "commute",
          label: "Commute",
          input: "commute",
          type: "categorical",
          missing: "neutral",
          source: "example",
          levels: [
            { value: "car", hazard_ratio: 1, prevalence: 0.8 },
            { value: "active", hazard_ratio: 0.9, prevalence: 0.2 },
          ],
        },
      ],
    },
  });
  const errorsFor = (model: OlmModel): string[] => {
    try {
      validateModel(structuredClone(model));
      return [];
    } catch (err) {
      return (err as OlmValidationError).errors;
    }
  };

  it("accepts a model with custom number and choice inputs", () => {
    expect(errorsFor(withCustom())).toEqual([]);
    expect(parseModel(serializeModel(withCustom())).inputs).toHaveLength(2);
  });

  it("uses custom answers in the calculation", () => {
    const model = validateModel(withCustom());
    const clean = calculate(model, { age: 40, sex: "female", custom: { pm25: 5, commute: "active" } });
    const dirty = calculate(model, { age: 40, sex: "female", custom: { pm25: 30, commute: "car" } });
    expect(clean.remaining_life_expectancy).toBeGreaterThan(dirty.remaining_life_expectancy);
    const pm = clean.factors.find((f) => f.id === "pm25")!;
    expect(pm.value).toBe(5);
    expect(pm.best_levels).toEqual([{ max: 10 }]);
  });

  it("treats a missing custom answer as average", () => {
    const model = validateModel(withCustom());
    const result = calculate(model, { age: 40, sex: "female" });
    expect(result.combined_hazard_ratio).toBeCloseTo(1, 10);
    expect(result.warnings).toHaveLength(2);
  });

  it("rejects custom answers that are out of range, wrong, or unknown", () => {
    const model = validateModel(withCustom());
    expect(() => calculate(model, { age: 40, sex: "male", custom: { pm25: 500 } })).toThrow(/between 0 and 200/);
    expect(() => calculate(model, { age: 40, sex: "male", custom: { commute: "boat" } })).toThrow(/one of: car, active/);
    expect(() => calculate(model, { age: 40, sex: "male", custom: { radon: 3 } })).toThrow(/not an input of this model/);
  });

  it("rejects factors that read an undeclared input", () => {
    const model = withCustom();
    model.inputs = model.inputs!.filter((i) => i.id !== "pm25");
    expect(errorsFor(model).join()).toMatch(/neither a standard input nor declared/);
  });

  it("rejects custom inputs that shadow standard ones or go unused", () => {
    const model = withCustom();
    model.inputs!.push({ id: "bmi", label: "BMI", type: "number", unit: "kg/m²", min: 10, max: 80 });
    model.inputs!.push({ id: "radon", label: "Radon", type: "number", unit: "Bq/m³", min: 0, max: 1000 });
    const errors = errorsFor(model).join();
    expect(errors).toMatch(/same id as a standard input/);
    expect(errors).toMatch(/"radon" is declared but no factor uses it/);
  });

  it("requires a categorical custom factor to cover exactly its choices", () => {
    const model = withCustom();
    const factor = model.adjustment!.factors[1]!;
    if (factor.type === "categorical") factor.levels[1]!.value = "bike";
    const errors = errorsFor(model).join();
    expect(errors).toMatch(/no level for "active"/);
    expect(errors).toMatch(/unknown level "bike"/);
  });

  it("limits the length of text that a calculator displays", () => {
    const model = withCustom();
    model.inputs![0]!.label = "x".repeat(41);
    expect(errorsFor(model).join()).toMatch(/must NOT have more than 40 characters/);
  });
});
