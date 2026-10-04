import { calculate } from "./calculate.ts";
import type { CalculationResult, ExpectedOutput, OlmModel } from "./types.ts";

export interface ReferenceCheck {
  test: string;
  output: ExpectedOutput;
  expected: number;
  tolerance: number;
  actual: number | null;
  passed: boolean;
}

function pick(result: CalculationResult, output: ExpectedOutput): number | null {
  switch (output) {
    case "remaining_life_expectancy":
      return result.remaining_life_expectancy;
    case "median_age_at_death":
      return result.median_age_at_death;
    case "equivalent_age":
      return result.equivalent_age;
    case "survival_to_80":
      return result.survival_to[80];
    case "survival_to_90":
      return result.survival_to[90];
    case "survival_to_100":
      return result.survival_to[100];
    case "combined_hazard_ratio":
      return result.combined_hazard_ratio;
  }
}

/** Run a model's embedded reference test cases. */
export function runReferenceTests(model: OlmModel): ReferenceCheck[] {
  const checks: ReferenceCheck[] = [];
  for (const test of model.tests ?? []) {
    const result = calculate(model, test.profile);
    for (const [output, expectation] of Object.entries(test.expect)) {
      const key = output as ExpectedOutput;
      const actual = pick(result, key);
      checks.push({
        test: test.name,
        output: key,
        expected: expectation.value,
        tolerance: expectation.tolerance,
        actual,
        passed: actual !== null && Math.abs(actual - expectation.value) <= expectation.tolerance,
      });
    }
  }
  return checks;
}
