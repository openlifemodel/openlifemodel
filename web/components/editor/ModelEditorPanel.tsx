"use client";

import { useState } from "react";
import type { OlmModel } from "@openlifemodel/engine";
import { syncLevels, type EditorTab, type Problem } from "@/lib/draft-model";
import { FactorsTab } from "./FactorsTab";
import { FileTab } from "./FileTab";
import { OverviewTab } from "./OverviewTab";
import { QuestionsTab } from "./QuestionsTab";
import { SourcesTab } from "./SourcesTab";

const TABS: { id: EditorTab; label: string }[] = [
  { id: "factors", label: "Risk factors" },
  { id: "questions", label: "Questions" },
  { id: "overview", label: "Overview" },
  { id: "sources", label: "Sources & assumptions" },
  { id: "file", label: "File" },
];

export function ModelEditorPanel({
  model,
  problems,
  onChange,
  onDownload,
  onImport,
  onReset,
  canReset,
}: {
  model: OlmModel;
  problems: Problem[];
  onChange: (next: OlmModel) => void;
  onDownload: () => void;
  onImport: () => void;
  onReset: () => void;
  canReset: boolean;
}) {
  const [tab, setTab] = useState<EditorTab>("factors");

  // Every edit works on a copy; categorical levels follow their question's choices.
  const edit = (change: (m: OlmModel) => void) => {
    const next = structuredClone(model);
    change(next);
    onChange(syncLevels(next));
  };

  const count = (t: EditorTab) => problems.filter((p) => p.tab === t).length;

  return (
    <section id="model-editor" className="card scroll-mt-20 p-5 sm:p-6" aria-labelledby="editor-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="editor-heading" className="text-lg font-semibold tracking-tight">
            Model editor
          </h2>
          <p className="mt-1 text-sm text-muted">
            Editing <strong className="text-fg">{model.name || "Untitled model"}</strong>. Results update as you type.
          </p>
        </div>
        {canReset && (
          <button type="button" className="btn" onClick={onReset}>
            Discard my edits
          </button>
        )}
      </div>

      {problems.length > 0 && (
        <div role="status" className="mt-4 rounded-xl bg-bad-soft p-4 text-sm text-bad">
          <p className="font-medium">
            {problems.length} thing{problems.length === 1 ? "" : "s"} to fix. Results show the last valid version until then.
          </p>
          <ul className="mt-2 space-y-1">
            {problems.slice(0, 8).map((p, i) => (
              <li key={i}>
                <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => setTab(p.tab)}>
                  {p.message}
                </button>
              </li>
            ))}
            {problems.length > 8 && <li>…and {problems.length - 8} more.</li>}
          </ul>
        </div>
      )}

      <div role="tablist" aria-label="Model editor sections" className="mt-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
            {count(t.id) > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] text-surface">{count(t.id)}</span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-5">
        {tab === "overview" && <OverviewTab model={model} edit={edit} />}
        {tab === "factors" && <FactorsTab model={model} edit={edit} />}
        {tab === "questions" && <QuestionsTab model={model} edit={edit} />}
        {tab === "sources" && <SourcesTab model={model} edit={edit} />}
        {tab === "file" && <FileTab model={model} valid={problems.length === 0} onDownload={onDownload} onImport={onImport} />}
      </div>
      <p className="mt-6 text-xs text-faint">
        Coming next: editing the life table itself, and saving your current results as reference tests.
      </p>
    </section>
  );
}
