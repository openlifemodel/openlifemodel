"use client";

import type { OlmModel } from "@openlifemodel/engine";

const STATUS: Record<OlmModel["status"], string> = {
  published: "Published data",
  experimental: "Experimental",
  illustrative: "Illustrative only",
};

/** The model chooser that sits under "About you", with the switch for the model editor. */
export function ModelCard({
  entries,
  selected,
  model,
  linkToPage,
  importErrors,
  editorOpen,
  onSelect,
  onImport,
  onToggleEditor,
}: {
  entries: { key: string; name: string; origin: string }[];
  selected: string;
  model: OlmModel;
  linkToPage: string | null;
  importErrors: string[];
  editorOpen: boolean;
  onSelect: (key: string) => void;
  onImport: () => void;
  onToggleEditor: (open: boolean) => void;
}) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="model-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="model-heading" className="text-lg font-semibold tracking-tight">
          Model
        </h2>
        <button type="button" className="text-xs font-medium text-accent-strong hover:underline" onClick={onImport}>
          Import a model
        </button>
      </div>
      <label className="block">
        <span className="sr-only">Choose a model</span>
        <select className="field" value={selected} onChange={(e) => onSelect(e.target.value)}>
          {entries.map((e) => (
            <option key={e.key} value={e.key}>
              {e.name}
              {e.origin === "imported" ? " (imported)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-muted" title={model.description}>
        <span className={`font-medium ${model.status === "illustrative" ? "text-bad" : "text-fg"}`}>{STATUS[model.status]}.</span>{" "}
        {model.description}
      </p>
      {linkToPage && (
        <a href={linkToPage} className="mt-2 inline-block text-xs font-medium text-accent-strong underline underline-offset-4">
          Sources and assumptions
        </a>
      )}
      {importErrors.length > 0 && (
        <ul role="alert" className="mt-3 list-disc rounded-lg bg-bad-soft py-2 pl-7 pr-3 text-xs text-bad">
          {importErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
        <button
          type="button"
          role="switch"
          aria-checked={editorOpen}
          aria-labelledby="editor-switch-label"
          onClick={() => onToggleEditor(!editorOpen)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${editorOpen ? "bg-accent" : "bg-line-strong"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${editorOpen ? "translate-x-5" : ""}`}
          />
        </button>
        <div>
          <div id="editor-switch-label" className="text-sm font-medium">
            Model editor
          </div>
          <p className="text-xs leading-relaxed text-muted">Change the numbers, add factors or build your own model.</p>
        </div>
      </div>
    </section>
  );
}
