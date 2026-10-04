"use client";

import type { OlmModel } from "@openlifemodel/engine";
import { AddButton, RemoveButton, SectionIntro, TextArea, TextField } from "./Fields";

type Edit = (change: (model: OlmModel) => void) => void;

export function SourcesTab({ model, edit }: { model: OlmModel; edit: Edit }) {
  const usedBy = (id: string) => [
    ...(model.baseline.source === id ? ["the life table"] : []),
    ...(model.adjustment?.factors.filter((f) => f.source === id).map((f) => f.label) ?? []),
  ];

  const optional = (i: number, key: "doi" | "url" | "license" | "notes") => (v: string) =>
    edit((m) => {
      const s = m.sources[i]!;
      if (v.trim() === "") delete s[key];
      else s[key] = v.trim();
    });

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-1 font-semibold">Sources</h3>
        <SectionIntro>Every number should point to where it came from. Risk factors and the life table pick from this list.</SectionIntro>
        <div className="space-y-4">
          {model.sources.map((source, i) => {
            const uses = usedBy(source.id);
            return (
              <section key={i} className="rounded-xl border border-line p-4" aria-label={`Source ${i + 1}`}>
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                  <TextArea label="Citation" rows={2} value={source.citation} onChange={(v) => edit((m) => void (m.sources[i]!.citation = v))} />
                  <RemoveButton
                    label={uses.length ? `Used by ${uses.join(", ")}; remove those links first` : `Remove source ${i + 1}`}
                    disabled={uses.length > 0}
                    onClick={() => edit((m) => void m.sources.splice(i, 1))}
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <TextField label="DOI (optional)" mono value={source.doi ?? ""} placeholder="10.1000/xyz123" onChange={optional(i, "doi")} />
                  <TextField label="Link (optional)" value={source.url ?? ""} placeholder="https://" onChange={optional(i, "url")} />
                  <TextField
                    label="ID"
                    mono
                    value={source.id}
                    onChange={(v) =>
                      edit((m) => {
                        const id = v.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
                        if (m.baseline.source === source.id) m.baseline.source = id;
                        for (const f of m.adjustment?.factors ?? []) if (f.source === source.id) f.source = id;
                        m.sources[i]!.id = id;
                      })
                    }
                  />
                </div>
                {uses.length > 0 && <p className="hint">Used by {uses.join(", ")}.</p>}
              </section>
            );
          })}
        </div>
        <div className="mt-3">
          <AddButton
            onClick={() =>
              edit((m) => {
                const taken = new Set(m.sources.map((s) => s.id));
                let n = m.sources.length + 1;
                while (taken.has(`source-${n}`)) n++;
                m.sources.push({ id: `source-${n}`, citation: "" });
              })
            }
          >
            Add source
          </AddButton>
        </div>
      </section>

      <section>
        <h3 className="mb-1 font-semibold">Assumptions</h3>
        <SectionIntro>Plain-language caveats people should know before trusting the numbers.</SectionIntro>
        <div className="space-y-2">
          {(model.assumptions ?? []).map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2">
              <TextArea label="" rows={2} value={a} onChange={(v) => edit((m) => void (m.assumptions![i] = v))} />
              <RemoveButton
                label={`Remove assumption ${i + 1}`}
                onClick={() =>
                  edit((m) => {
                    m.assumptions!.splice(i, 1);
                    if (m.assumptions!.length === 0) delete m.assumptions;
                  })
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <AddButton onClick={() => edit((m) => void (m.assumptions = [...(m.assumptions ?? []), ""]))}>Add assumption</AddButton>
        </div>
      </section>
    </div>
  );
}
