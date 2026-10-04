import type { OlmModel, Source } from "@openlifemodel/engine";

/** A life table people can pick in the model editor. */
export interface LibraryTable {
  id: string;
  name: string;
  region?: string;
  source: Source;
  baseline: OlmModel["baseline"];
}

/**
 * The life table library is every distinct baseline among the bundled
 * models. Adding a table-only model file (like us-ssa-2023-period) adds it
 * here too.
 */
export function lifeTableLibrary(models: OlmModel[]): LibraryTable[] {
  const seen = new Set<string>();
  const tables: LibraryTable[] = [];
  // Table-only models first: their names describe the table itself.
  for (const model of [...models].sort((a, b) => Number(Boolean(a.adjustment)) - Number(Boolean(b.adjustment)))) {
    const source = model.sources.find((s) => s.id === model.baseline.source);
    const key = JSON.stringify(model.baseline.qx);
    if (!source || seen.has(key)) continue;
    seen.add(key);
    tables.push({
      id: model.id,
      name: model.adjustment ? `Life table from ${model.name}` : model.name,
      ...(model.baseline.region && { region: model.baseline.region }),
      source,
      baseline: model.baseline,
    });
  }
  return tables;
}
