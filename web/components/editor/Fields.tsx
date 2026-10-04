"use client";

import { useEffect, useState } from "react";

// Small form controls for the model editor. Labels are always visible so the
// editor reads like a form, not a spreadsheet.

export function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      <input
        className={`field ${mono ? "font-mono text-sm" : ""}`}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  maxLength,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      <textarea
        className="field !h-auto py-2 leading-relaxed"
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

/**
 * A number input that keeps what the person is typing (e.g. "1." or "-")
 * and reports a number only when the text is a valid one. An empty box
 * reports undefined when `optional` is set.
 */
export function NumberField({
  label,
  value,
  onChange,
  optional,
  step = "any",
  compact,
  ariaLabel,
  placeholder,
}: {
  label?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  optional?: boolean;
  step?: string;
  compact?: boolean;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    // Follow outside changes (e.g. "make shares add up") without clobbering typing.
    if (value === undefined ? text.trim() !== "" : Number(text) !== value) setText(value === undefined ? "" : String(value));
  }, [value]);
  const input = (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      aria-label={ariaLabel ?? label}
      placeholder={placeholder}
      className={`field tabular-nums ${compact ? "h-9 w-full max-w-32" : ""}`}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.trim();
        if (raw === "" && optional) onChange(undefined);
        else if (raw !== "" && Number.isFinite(Number(raw))) onChange(Number(raw));
      }}
    />
  );
  if (!label) return input;
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      {input}
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function RemoveButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-faint transition enabled:hover:bg-bad-soft enabled:hover:text-bad disabled:opacity-40"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
      </svg>
    </button>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="btn" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {children}
    </button>
  );
}

export function SectionIntro({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 max-w-3xl text-sm leading-relaxed text-muted">{children}</p>;
}
