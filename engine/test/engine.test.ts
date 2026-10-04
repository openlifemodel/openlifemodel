import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculate,
  OlmValidationError,
  parseModel,
  runReferenceTests,
  serializeModel,
  type OlmModel,
} from "../src/index.ts";

const modelsDir = new URL("../../models/", import.meta.url);
const modelFiles = readdirSync(modelsDir).filter((f) => f.endsWith(".olm"));
const load = (file: string): OlmModel => parseModel(readFileSync(new URL(file, modelsDir), "utf8"));

describe("bundled models", () => {
  it("finds the example models", () => {
    expect(modelFiles).toContain("us-ssa-2023-period.olm");
    expect(modelFiles).toContain("illustrative-lifestyle.olm");
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

describe("calculate", () => {
  const baseline = load("us-ssa-2023-period.olm");
  const lifestyle = load("illustrative-lifestyle.olm");

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

  it("uses [min, max) band boundaries", () => {
    const at25 = calculate(lifestyle, { age: 40, sex: "male", bmi: 25 });
    const below = calculate(lifestyle, { age: 40, sex: "male", bmi: 24.99 });
    expect(at25.combined_hazard_ratio).toBeGreaterThan(below.combined_hazard_ratio);
  });

  it("warns about missing inputs treated as neutral", () => {
    const result = calculate(lifestyle, { age: 40, sex: "male", bmi: 22 });
    expect(result.warnings).toHaveLength(3);
  });

  it("rejects invalid profiles", () => {
    expect(() => calculate(baseline, { age: 40 })).toThrow(OlmValidationError);
    expect(() => calculate(baseline, { age: 40, sex: "male", bmi: 500 })).toThrow(OlmValidationError);
    expect(() => calculate(baseline, { age: 40, sex: "male", height: 180 })).toThrow(OlmValidationError);
  });
});

describe("validation", () => {
  const text = readFileSync(new URL("illustrative-lifestyle.olm", modelsDir), "utf8");
  const base = (): OlmModel => structuredClone(parseModel(text));
  const errorsFor = (model: unknown): string[] => {
    try {
      parseModel(serializeModel(model as OlmModel));
      return [];
    } catch (err) {
      return (err as OlmValidationError).errors;
    }
  };

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
    if (factor.type === "categorical") factor.levels = factor.levels.slice(0, 2);
    expect(errorsFor(model).join()).toMatch(/no level for "current"/);
  });
});
