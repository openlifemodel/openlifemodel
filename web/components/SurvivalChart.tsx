"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { SurvivalPoint } from "@openlifemodel/engine";

interface Props {
  you: SurvivalPoint[];
  population: SurvivalPoint[];
  medianAge: number;
}

const PAD = { top: 16, right: 12, bottom: 36, left: 40 };
const MAX_AGE = 110;

const pct = (s: number) => `${Math.round(s * 100)}%`;

export function SurvivalChart({ you, population, medianAge }: Props) {
  // useId() can contain characters that are not valid in url(#id) references.
  const gradientId = `fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [hoverAge, setHoverAge] = useState<number | null>(null);
  // Draw in real pixels so text stays readable at any width.
  const wrapper = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setW(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const H = W < 480 ? 240 : 300;

  const startAge = you[0]?.age ?? 0;
  const endAge = Math.max(MAX_AGE, startAge + 10);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (age: number) => PAD.left + ((age - startAge) / (endAge - startAge)) * plotW;
  const y = (s: number) => PAD.top + (1 - s) * plotH;
  const visible = (points: SurvivalPoint[]) => points.filter((p) => p.age <= endAge);
  const line = (points: SurvivalPoint[]) =>
    visible(points)
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.age).toFixed(1)},${y(p.survival).toFixed(1)}`)
      .join(" ");
  const youVisible = visible(you);
  const area = `${line(you)} L${x(youVisible.at(-1)?.age ?? endAge).toFixed(1)},${y(0)} L${x(startAge)},${y(0)} Z`;

  const ticks: number[] = [];
  const step = W < 420 && endAge - startAge > 50 ? 20 : 10;
  for (let a = Math.ceil(startAge / step) * step; a <= endAge; a += step) ticks.push(a);

  const at = (points: SurvivalPoint[], age: number) => points.find((p) => p.age === age)?.survival ?? 0;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const age = Math.round(startAge + ((px - PAD.left) / plotW) * (endAge - startAge));
    setHoverAge(Math.min(Math.max(age, startAge), endAge));
  };

  const hover =
    hoverAge === null
      ? null
      : { age: hoverAge, you: at(you, hoverAge), population: at(population, hoverAge) };
  const tipLeft = hover ? x(hover.age) > W * 0.6 : false;

  return (
    <div ref={wrapper} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label={`Survival curve from age ${startAge}: the chance of being alive at each later age. Median age at death ${medianAge.toFixed(1)}.`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHoverAge(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((s) => (
          <g key={s}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(s)} y2={y(s)} stroke="var(--border)" strokeDasharray={s === 0 ? undefined : "3 4"} />
            <text x={PAD.left - 10} y={y(s) + 4} textAnchor="end" fontSize="11" fill="var(--faint)">
              {s * 100}%
            </text>
          </g>
        ))}
        {ticks.map((a) => (
          <text key={a} x={x(a)} y={H - PAD.bottom + 20} textAnchor="middle" fontSize="11" fill="var(--faint)">
            {a}
          </text>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line(population)} fill="none" stroke="var(--chart-base)" strokeWidth="1.75" strokeDasharray="5 5" />
        <path d={line(you)} fill="none" stroke="var(--accent)" strokeWidth="2.75" strokeLinejoin="round" />
        {medianAge <= endAge && !hover && (
          <g>
            <line x1={x(medianAge)} x2={x(medianAge)} y1={y(0.5)} y2={y(0)} stroke="var(--accent)" strokeDasharray="2 4" />
            <circle cx={x(medianAge)} cy={y(0.5)} r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
            <text
              x={x(medianAge) + (x(medianAge) > W * 0.7 ? -10 : 10)}
              y={y(0.5) - 10}
              textAnchor={x(medianAge) > W * 0.7 ? "end" : "start"}
              fontSize="12"
              fontWeight="600"
              fill="var(--text)"
              stroke="var(--surface)"
              strokeWidth="4"
              paintOrder="stroke"
            >
              Half reach {Math.round(medianAge)}
            </text>
          </g>
        )}
        {hover && (
          <g>
            <line x1={x(hover.age)} x2={x(hover.age)} y1={PAD.top} y2={y(0)} stroke="var(--border-strong)" />
            <circle cx={x(hover.age)} cy={y(hover.population)} r="4" fill="var(--chart-base)" />
            <circle cx={x(hover.age)} cy={y(hover.you)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          style={tipLeft ? { right: `${((W - x(hover.age)) / W) * 100 + 2}%` } : { left: `${(x(hover.age) / W) * 100 + 2}%` }}
          role="status"
        >
          <div className="mb-1 font-semibold">Alive at {hover.age}</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" /> You <span className="ml-auto pl-3 font-semibold tabular-nums">{pct(hover.you)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-full bg-[var(--chart-base)]" /> Average <span className="ml-auto pl-3 tabular-nums">{pct(hover.population)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
