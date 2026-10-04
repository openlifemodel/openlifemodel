"use client";

import type { OlmModel } from "@openlifemodel/engine";
import { LICENSES } from "@/lib/draft-model";
import { AddButton, RemoveButton, SectionIntro, SelectField, TextArea, TextField } from "./Fields";

type Edit = (change: (model: OlmModel) => void) => void;

const STATUSES = [
  { value: "illustrative", label: "Illustrative: shows the format, numbers not evidence-based" },
  { value: "experimental", label: "Experimental: based on evidence, not validated as a whole" },
  { value: "published", label: "Published: reproduces an authoritative source" },
] as const;

export function OverviewTab({ model, edit }: { model: OlmModel; edit: Edit }) {
  const knownLicense = LICENSES.some((l) => l.id === model.license);
  return (
    <div className="space-y-5">
      <SectionIntro>
        What the model is called, who made it, and the terms others can use it under. This is what people see
        before they open the numbers.
      </SectionIntro>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Name"
          value={model.name}
          maxLength={200}
          onChange={(v) => edit((m) => void (m.name = v))}
        />
        <TextField
          label="ID"
          mono
          value={model.id}
          maxLength={100}
          hint="Lowercase letters, digits and hyphens. Used as the file name."
          onChange={(v) => edit((m) => void (m.id = v.toLowerCase().replace(/[^a-z0-9-]/g, "-")))}
        />
        <TextField
          label="Version"
          mono
          value={model.version}
          hint="e.g. 1.0.0. Raise it whenever you change a number."
          onChange={(v) => edit((m) => void (m.version = v.trim()))}
        />
        <SelectField
          label="Status"
          value={model.status}
          options={STATUSES}
          onChange={(v) => edit((m) => void (m.status = v))}
        />
        <SelectField
          label="Licence for this model file"
          value={knownLicense ? model.license : "other"}
          options={[...LICENSES.map((l) => ({ value: l.id as string, label: l.label })), { value: "other", label: "Other (type an SPDX id)" }]}
          onChange={(v) => edit((m) => void (m.license = v === "other" ? "" : v))}
        />
        {!knownLicense && (
          <TextField
            label="Licence identifier"
            mono
            value={model.license}
            placeholder="e.g. CC-BY-ND-4.0 or LicenseRef-mine"
            onChange={(v) => edit((m) => void (m.license = v.trim()))}
          />
        )}
      </div>
      <TextArea
        label="Description"
        rows={3}
        value={model.description}
        hint="One or two sentences: what the model adjusts for and where the numbers come from."
        onChange={(v) => edit((m) => void (m.description = v))}
      />
      <TextArea
        label="Intended population"
        rows={2}
        value={model.population ?? ""}
        onChange={(v) =>
          edit((m) => {
            if (v.trim() === "") delete m.population;
            else m.population = v;
          })
        }
      />
      <div>
        <div className="label">Authors</div>
        <div className="space-y-2">
          {model.authors.map((author, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <TextField
                label={i === 0 ? "Name" : ""}
                value={author.name}
                onChange={(v) => edit((m) => void (m.authors[i]!.name = v))}
              />
              <TextField
                label={i === 0 ? "Link (optional)" : ""}
                value={author.url ?? ""}
                placeholder="https://"
                onChange={(v) =>
                  edit((m) => {
                    const a = m.authors[i]!;
                    if (v.trim() === "") delete a.url;
                    else a.url = v.trim();
                  })
                }
              />
              <RemoveButton
                label={`Remove author ${author.name || i + 1}`}
                onClick={() => edit((m) => void m.authors.splice(i, 1))}
              />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <AddButton onClick={() => edit((m) => void m.authors.push({ name: "" }))}>Add author</AddButton>
        </div>
      </div>
    </div>
  );
}
