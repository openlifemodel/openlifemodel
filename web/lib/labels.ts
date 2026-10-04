import type { CustomInput, Factor, OlmModel } from "@openlifemodel/engine";

/** Human-readable names for PersonProfile values shown in the UI. */
export const LEVEL_LABELS: Record<string, string> = {
  never: "Never smoked",
  current: "Smoke now",
  former: "Quit, age unknown",
  former_quit_before_35: "Quit before 35",
  former_quit_35_44: "Quit at 35–44",
  former_quit_45_54: "Quit at 45–54",
  former_quit_55_plus: "Quit at 55+",
};

/** Display name for a categorical level: a custom choice's label, or a standard value's name. */
export function levelLabel(model: OlmModel, factor: Factor, value: string): string {
  const custom: CustomInput | undefined = model.inputs?.find((i) => i.id === factor.input);
  return custom?.choices?.find((c) => c.value === value)?.label ?? LEVEL_LABELS[value] ?? value;
}
