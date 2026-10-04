"use client";

import { runReferenceTests, type ModelTest, type OlmModel, type PersonProfile } from "@openlifemodel/engine";
import { pinTest, STANDARD_LABELS, typicalTests } from "@/lib/draft-model";
import { LEVEL_LABELS } from "@/lib/labels";
import { AddButton, RemoveButton, SectionIntro, SelectField, TextField } from "./Fields";

type Edit = (change: (model: OlmModel) => void) => void;

const OUTPUT_NAMES: Record<string, string> = {
  remaining_life_expectancy: "Remaining years",
  median_age_at_death: "Median age at death",
  equivalent_age: "Equivalent age",
  survival_to_80: "Chance of reaching 80",
  survival_to_90: "Chance of reaching 90",
  survival_to_100: "Chance of reaching 100",
  combined_hazard_ratio: "Combined hazard ratio",
};

/** Results of running each test against the current draft. */
export function testStatus(model: OlmModel): { failing: Set<string>; checks: ReturnType<typeof runReferenceTests> } {
  try {
    const checks = runReferenceTests(model);
    return { failing: new Set(checks.filter((c) => !c.passed).map((c) => c.test)), checks };
  } catch {
    // A test whose profile no longer fits the model (e.g. a removed question).
    return { failing: new Set((model.tests ?? []).map((t) => t.name)), checks: [] };
  }
}

function describeProfile(model: OlmModel, profile: PersonProfile): string {
  const parts: string[] = [`age ${profile.age}`];
  if (profile.sex) parts.push(profile.sex);
  for (const [key, value] of Object.entries(profile)) {
    if (key === "age" || key === "sex" || key === "custom") continue;
    parts.push(`${STANDARD_LABELS[key] ?? key}: ${LEVEL_LABELS[String(value)]?.toLowerCase() ?? value}`);
  }
  for (const [key, value] of Object.entries(profile.custom ?? {})) {
    parts.push(`${model.inputs?.find((i) => i.id === key)?.label ?? key}: ${value}`);
  }
  return parts.join(" · ");
}

export function TestsTab({
  model,
  edit,
  currentProfile,
  canRun,
}: {
  model: OlmModel;
  edit: Edit;
  currentProfile: PersonProfile | null;
  canRun: boolean;
}) {
  const tests = model.tests ?? [];
  const { failing, checks } = canRun ? testStatus(model) : { failing: new Set<string>(), checks: [] };

  const repin = (index: number) =>
    edit((m) => {
      const old = m.tests![index]!;
      m.tests![index] = { ...pinTest(m, old.name, old.profile) };
    });

  const add = (make: () => ModelTest[]) => {
    let made: ModelTest[];
    try {
      made = make();
    } catch {
      return; // e.g. the current answers don't fit this model
    }
    edit((m) => {
      const names = new Set((m.tests ?? []).map((t) => t.name));
      m.tests = [...(m.tests ?? []), ...made.filter((t) => !names.has(t.name))];
    });
  };

  return (
    <div className="space-y-5">
      <SectionIntro>
        Reference tests are example people with the results this model must give. Anyone re-implementing OLM, in R,
        Python or anything else, can run them to prove they get the same numbers. Tests marked{" "}
        <strong>published</strong> use figures reported by the source itself, the strongest check that the model was
        copied correctly.
      </SectionIntro>

      {!canRun && <p className="text-sm text-bad">Fix the problems listed above to run the tests.</p>}

      {failing.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-bad-soft p-3 text-sm text-bad">
          {failing.size} test{failing.size === 1 ? " no longer matches" : "s no longer match"} the model, probably because you
          changed some numbers.
          <button
            type="button"
            className="font-medium underline underline-offset-4"
            onClick={() =>
              edit((m) => {
                m.tests = (m.tests ?? []).map((t) => (failing.has(t.name) ? pinTest(m, t.name, t.profile) : t));
              })
            }
          >
            Update them all to the current results
          </button>
        </div>
      )}

      {tests.map((test, i) => {
        const fails = failing.has(test.name);
        const results = checks.filter((c) => c.test === test.name);
        return (
          <section key={i} className={`rounded-xl border p-4 ${fails ? "border-bad" : "border-line"}`} aria-label={`Test: ${test.name}`}>
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_14rem_auto]">
              <TextField label="Name" value={test.name} onChange={(v) => edit((m) => void (m.tests![i]!.name = v))} />
              <SelectField
                label="Where the values came from"
                value={test.origin ?? "reference-engine"}
                options={[
                  { value: "published", label: "Published by the source" },
                  { value: "reference-engine", label: "Pinned from the engine" },
                ]}
                onChange={(v) => edit((m) => void (m.tests![i]!.origin = v))}
              />
              <RemoveButton
                label={`Remove test ${test.name}`}
                onClick={() =>
                  edit((m) => {
                    m.tests!.splice(i, 1);
                    if (m.tests!.length === 0) delete m.tests;
                  })
                }
              />
            </div>
            <p className="mt-2 text-xs text-muted">{describeProfile(model, test.profile)}</p>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {Object.entries(test.expect).map(([output, expected]) => {
                  const check = results.find((c) => c.output === output);
                  return (
                    <tr key={output} className="border-t border-line">
                      <td className="py-1 pr-3 text-muted">{OUTPUT_NAMES[output] ?? output}</td>
                      <td className="py-1 pr-3 tabular-nums">
                        {expected.value} <span className="text-faint">± {expected.tolerance}</span>
                      </td>
                      <td className={`py-1 text-right tabular-nums ${check && !check.passed ? "text-bad" : "text-good"}`}>
                        {check ? (check.passed ? "✓ " : "✗ got ") + (check.actual === null ? "n/a" : Number(check.actual.toFixed(4))) : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {fails && canRun && (
              <button type="button" className="mt-2 text-sm font-medium text-accent-strong underline underline-offset-4" onClick={() => repin(i)}>
                Update to the current results
              </button>
            )}
          </section>
        );
      })}

      {tests.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">This model has no reference tests yet.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <AddButton onClick={() => canRun && add(() => typicalTests(model))}>Add tests for typical people</AddButton>
        {currentProfile && (
          <AddButton
            onClick={() => canRun && add(() => [pinTest(model, `Your answers (age ${currentProfile.age})`, currentProfile)])}
          >
            Add a test from your answers
          </AddButton>
        )}
      </div>
    </div>
  );
}
