import type { SurvivalPoint } from "@openlifemodel/engine";

interface Props {
  you: SurvivalPoint[];
  population: SurvivalPoint[];
  medianAge: number;
}

const W = 640;
const H = 280;
const PAD = { top: 12, right: 16, bottom: 36, left: 44 };
const MAX_AGE = 110;

export function SurvivalChart({ you, population, medianAge }: Props) {
  const startAge = you[0]?.age ?? 0;
  const span = Math.max(MAX_AGE - startAge, 10);
  const x = (age: number) => PAD.left + ((age - startAge) / span) * (W - PAD.left - PAD.right);
  const y = (s: number) => PAD.top + (1 - s) * (H - PAD.top - PAD.bottom);
  const line = (points: SurvivalPoint[]) =>
    points
      .filter((p) => p.age <= startAge + span)
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.age).toFixed(1)},${y(p.survival).toFixed(1)}`)
      .join(" ");

  const firstTick = Math.ceil(startAge / 10) * 10;
  const ticks: number[] = [];
  for (let a = firstTick; a <= startAge + span; a += 10) ticks.push(a);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Survival curve: chance of being alive at each age from ${startAge}. Median age at death ${medianAge.toFixed(1)}.`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((s) => (
        <g key={s}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(s)} y2={y(s)} stroke="var(--border)" />
          <text x={PAD.left - 8} y={y(s) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {s * 100}%
          </text>
        </g>
      ))}
      {ticks.map((a) => (
        <text key={a} x={x(a)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize="11" fill="var(--muted)">
          {a}
        </text>
      ))}
      <text x={(W + PAD.left) / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--muted)">
        Age
      </text>
      <path d={line(population)} fill="none" stroke="var(--chart-base)" strokeWidth="2" strokeDasharray="5 4" />
      <path d={line(you)} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" />
      {medianAge <= startAge + span && (
        <g>
          <line
            x1={x(medianAge)}
            x2={x(medianAge)}
            y1={y(0.5)}
            y2={H - PAD.bottom}
            stroke="var(--color-accent)"
            strokeDasharray="2 3"
          />
          <circle cx={x(medianAge)} cy={y(0.5)} r="4" fill="var(--color-accent)" />
        </g>
      )}
    </svg>
  );
}
