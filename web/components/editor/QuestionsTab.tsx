"use client";

import type { CustomInput, OlmModel } from "@openlifemodel/engine";
import { newCustomInput, newFactor, slugify } from "@/lib/draft-model";
import { AddButton, NumberField, RemoveButton, SectionIntro, TextField } from "./Fields";

type Edit = (change: (model: OlmModel) => void) => void;

export function QuestionsTab({ model, edit }: { model: OlmModel; edit: Edit }) {
  const inputs = model.inputs ?? [];

  const add = (type: "number" | "choice") =>
    edit((m) => {
      const input = newCustomInput(m, type);
      m.inputs = [...(m.inputs ?? []), input];
      // Every question must be used, so it starts with a neutral risk factor.
      const factor = newFactor(m, input.id);
      if (m.adjustment) m.adjustment.factors.push(factor);
      else m.adjustment = { method: "proportional-hazards", normalization: "population-average", factors: [factor] };
    });

  return (
    <div className="space-y-5">
      <SectionIntro>
        Standard questions (smoking, BMI, exercise and more) are shared by every model so results can be compared. Add
        your own when your evidence needs something else, such as air pollution or a study&apos;s own categories. Each
        new question gets a risk factor you can fill in on the Risk factors tab.
      </SectionIntro>

      {inputs.map((input, i) => (
        <QuestionCard key={i} model={model} input={input} index={i} edit={edit} />
      ))}

      {inputs.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong p-5 text-sm text-muted">
          This model only uses standard questions.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <AddButton onClick={() => add("number")}>Add number question</AddButton>
        <AddButton onClick={() => add("choice")}>Add choice question</AddButton>
      </div>
    </div>
  );
}

function QuestionCard({ model, input, index, edit }: { model: OlmModel; input: CustomInput; index: number; edit: Edit }) {
  const change = (fn: (i: CustomInput) => void) => edit((m) => fn(m.inputs![index]!));
  const usedBy = model.adjustment?.factors.filter((f) => f.input === input.id) ?? [];

  const optionalText = (key: "question" | "help") => (v: string) =>
    change((i) => {
      if (v.trim() === "") delete i[key];
      else i[key] = v;
    });

  return (
    <section className="rounded-xl border border-line p-4 sm:p-5" aria-label={`Question: ${input.label}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-faint">
          {input.type === "number" ? "Number question" : "Choice question"}
        </div>
        <RemoveButton
          label={`Remove question ${input.label}${usedBy.length ? " and its risk factor" : ""}`}
          onClick={() =>
            edit((m) => {
              m.inputs!.splice(index, 1);
              if (m.inputs!.length === 0) delete m.inputs;
              if (m.adjustment) {
                m.adjustment.factors = m.adjustment.factors.filter((f) => f.input !== input.id);
                if (m.adjustment.factors.length === 0) delete m.adjustment;
              }
            })
          }
        />
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <TextField
          label="Short label"
          value={input.label}
          maxLength={40}
          onChange={(v) =>
            edit((m) => {
              // Risk factors still named after the question follow the rename.
              for (const f of m.adjustment?.factors ?? []) if (f.input === input.id && f.label === input.label) f.label = v;
              m.inputs![index]!.label = v;
            })
          }
        />
        <TextField
          label="ID"
          mono
          value={input.id}
          maxLength={40}
          hint="Used in profiles and files. Lowercase, digits and underscores."
          onChange={(v) =>
            edit((m) => {
              const id = v.toLowerCase().replace(/[^a-z0-9_]/g, "_");
              // Keep risk factors pointing at the renamed question.
              for (const f of m.adjustment?.factors ?? []) if (f.input === input.id) f.input = id;
              m.inputs![index]!.id = id;
            })
          }
        />
        <TextField label="Question shown to people (optional)" value={input.question ?? ""} maxLength={80} onChange={optionalText("question")} />
        <TextField label="Help text (optional)" value={input.help ?? ""} maxLength={240} onChange={optionalText("help")} />
      </div>

      {input.type === "number" ? (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <TextField label="Unit" value={input.unit ?? ""} maxLength={16} onChange={(v) => change((i) => void (i.unit = v))} />
          <NumberField label="Lowest allowed" value={input.min} onChange={(v) => v !== undefined && change((i) => void (i.min = v))} />
          <NumberField label="Highest allowed" value={input.max} onChange={(v) => v !== undefined && change((i) => void (i.max = v))} />
          <NumberField
            label="Step (optional)"
            optional
            value={input.step}
            onChange={(v) =>
              change((i) => {
                if (v === undefined) delete i.step;
                else i.step = v;
              })
            }
          />
        </div>
      ) : (
        <div className="mt-3">
          <div className="label">Choices</div>
          <div className="space-y-2">
            {(input.choices ?? []).map((choice, ci) => (
              <div key={ci} className="grid grid-cols-[1fr_auto] items-end gap-2">
                <TextField
                  label=""
                  value={choice.label}
                  maxLength={40}
                  onChange={(v) =>
                    edit((m) => {
                      const c = m.inputs![index]!.choices![ci]!;
                      const oldValue = c.value;
                      c.label = v;
                      c.value = slugify(v, "_");
                      // Keep the matching risk factor level in step with the renamed choice.
                      for (const f of m.adjustment?.factors ?? []) {
                        if (f.input === input.id && f.type === "categorical") {
                          const level = f.levels.find((l) => l.value === oldValue);
                          if (level) level.value = c.value;
                        }
                      }
                    })
                  }
                />
                {(input.choices ?? []).length > 2 && (
                  <RemoveButton label={`Remove choice ${choice.label}`} onClick={() => change((i) => void i.choices!.splice(ci, 1))} />
                )}
              </div>
            ))}
          </div>
          {(input.choices ?? []).length < 12 && (
            <div className="mt-2">
              <AddButton
                onClick={() =>
                  change((i) => {
                    const n = (i.choices ?? []).length + 1;
                    i.choices = [...(i.choices ?? []), { value: `option_${n}`, label: `Option ${n}` }];
                  })
                }
              >
                Add choice
              </AddButton>
            </div>
          )}
        </div>
      )}
      {usedBy.length > 0 && (
        <p className="hint mt-3">Used by the risk factor &quot;{usedBy.map((f) => f.label).join(", ")}&quot;.</p>
      )}
    </section>
  );
}
