"use client";

import { serializeModel, type OlmModel } from "@openlifemodel/engine";
import { SectionIntro } from "./Fields";

export function FileTab({
  model,
  valid,
  blocker,
  onDownload,
  onImport,
}: {
  model: OlmModel;
  valid: boolean;
  blocker: string | null;
  onDownload: () => void;
  onImport: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionIntro>
        Your edits are saved in this browser automatically. Download the file to keep a copy, share it, or load it again
        later with Import. The file is plain text, so you can also read it here or open it in any editor.
      </SectionIntro>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={!valid} onClick={onDownload}>
          Download {model.id || "model"}.olm.yaml
        </button>
        <button type="button" className="btn" onClick={onImport}>
          Import a model file
        </button>
      </div>
      {!valid && blocker && <p className="text-sm text-bad">{blocker}</p>}
      <details>
        <summary className="cursor-pointer text-sm font-medium text-accent-strong">Show the file</summary>
        <pre className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed">
          {serializeModel(model)}
        </pre>
      </details>
    </div>
  );
}
