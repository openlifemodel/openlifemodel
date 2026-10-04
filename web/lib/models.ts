import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseModel, type OlmModel } from "@openlifemodel/engine";

// Bundled models are read from the repository's /models directory at build
// time, so the site always ships exactly the files that CI tested.
const MODELS_DIR = path.join(process.cwd(), "..", "models");

// Order in which models appear in the calculator; the first is the default.
const ORDER = ["us-lifestyle", "us-ssa-2023-period"];

export interface BundledModel {
  file: string;
  text: string;
  model: OlmModel;
}

let cache: BundledModel[] | undefined;

export function bundledModels(): BundledModel[] {
  cache ??= readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".olm.yaml"))
    .map((file) => {
      const text = readFileSync(path.join(MODELS_DIR, file), "utf8");
      return { file, text, model: parseModel(text) };
    })
    .sort((a, b) => rank(a.model.id) - rank(b.model.id));
  return cache;
}

function rank(id: string): number {
  const i = ORDER.indexOf(id);
  return i === -1 ? ORDER.length : i;
}

export function bundledModel(id: string): BundledModel | undefined {
  return bundledModels().find((m) => m.model.id === id);
}
