"use client";

import { useRef, useState } from "react";
import type { OlmModel, PersonProfile } from "@openlifemodel/engine";
import type { LibraryTable } from "@/lib/life-tables";
import { syncLevels, type EditorTab, type Problem } from "@/lib/draft-model";
import { FactorsTab } from "./FactorsTab";
import { FileTab } from "./FileTab";
import { LifeTableTab } from "./LifeTableTab";
import { OverviewTab } from "./OverviewTab";
import { QuestionsTab } from "./QuestionsTab";
import { SourcesTab } from "./SourcesTab";
import { TestsTab, testStatus } from "./TestsTab";

const TABS: { id: EditorTab; label: string }[] = [
  { id: "factors", label: "Risk factors" },
  { id: "questions", label: "Questions" },
  { id: "lifetable", label: "Life table" },
  { id: "overview", label: "Overview" },
  { id: "sources", label: "Sources & assumptions" },
  { id: "tests", label: "Tests" },
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
  library,
  currentProfile,
}: {
  model: OlmModel;
  problems: Problem[];
  onChange: (next: OlmModel) => void;
  onDownload: () => void;
  onImport: () => void;
  onReset: () => void;
  canReset: boolean;
  library: LibraryTable[];
  currentProfile: PersonProfile | null;
}) {
  const [tab, setTab] = useState<EditorTab>("factors");
  const confirmDiscard = useRef<HTMLDialogElement>(null);

  // Every edit works on a copy; categorical levels follow their question's choices.
  const edit = (change: (m: OlmModel) => void) => {
    const next = structuredClone(model);
    change(next);
    onChange(syncLevels(next));
  };

  // Tests run only on a valid model; ones that no longer match block downloading.
  const canRun = problems.length === 0;
  const failingTests = canRun ? testStatus(model).failing.size : 0;
  const count = (t: EditorTab) => problems.filter((p) => p.tab === t).length + (t === "tests" ? failingTests : 0);

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
          <button type="button" className="btn" onClick={() => confirmDiscard.current?.showModal()}>
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

      <dialog
        ref={confirmDiscard}
        aria-labelledby="discard-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-6 text-fg shadow-xl backdrop:bg-black/40"
      >
        <h3 id="discard-title" className="text-lg font-semibold">
          Discard all edits to {model.name || "this model"}?
        </h3>
        <p className="mt-2 text-sm text-muted">
          This removes your edited copy and returns to the original model. It can&apos;t be undone.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn mr-auto"
            // Saving work only needs a valid model; out-of-date tests are kept in the file as they are.
            disabled={problems.length > 0}
            title={problems.length > 0 ? "Fix the problems listed in the editor to download" : undefined}
            onClick={onDownload}
          >
            Download a copy first
          </button>
          <button type="button" className="btn" autoFocus onClick={() => confirmDiscard.current?.close()}>
            Cancel
          </button>
          <button
            type="button"
            className="btn !border-bad !bg-bad !text-surface hover:!opacity-90"
            onClick={() => {
              confirmDiscard.current?.close();
              onReset();
            }}
          >
            Discard edits
          </button>
        </div>
      </dialog>

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
        {tab === "lifetable" && <LifeTableTab model={model} edit={edit} library={library} />}
        {tab === "sources" && <SourcesTab model={model} edit={edit} />}
        {tab === "tests" && <TestsTab model={model} edit={edit} currentProfile={currentProfile} canRun={canRun} />}
        {tab === "file" && (
          <FileTab
            model={model}
            valid={canRun && failingTests === 0}
            blocker={!canRun ? "Fix the problems listed above to download." : failingTests > 0 ? "Some reference tests no longer match; update or remove them on the Tests tab." : null}
            onDownload={onDownload}
            onImport={onImport}
          />
        )}
      </div>
    </section>
  );
}
