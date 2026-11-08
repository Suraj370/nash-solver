"use client";

import type { Equilibrium } from "@/lib/types";

const W = 400;
const H = 380;
const PL = 62;
const PT = 14;
const INNER = 318;
const X = (p: number) => PL + p * INNER;
const Y = (q: number) => PT + (1 - q) * INNER;

type Pt = [number, number];

/** Best-response correspondence of a player whose payoff gap is linear: gap(t) = a*t + b. */
function correspondence(a: number, b: number): { path: Pt[]; indifferent: boolean } {
  const eps = 1e-12;
  if (Math.abs(a) < eps && Math.abs(b) < eps) return { path: [], indifferent: true };
  const side = (t: number) => (a * t + b > 0 ? 1 : 0);
  const root = Math.abs(a) < eps ? null : -b / a;
  if (root === null || root <= 0 || root >= 1) {
    return {
      path: [
        [side(0.5), 0],
        [side(0.5), 1],
      ],
      indifferent: false,
    };
  }
  const lo = side(root / 2);
  const hi = side((1 + root) / 2);
  return {
    path: [
      [lo, 0],
      [lo, root],
      [hi, root],
      [hi, 1],
    ],
    indifferent: false,
  };
}

export function BestResponsePlot({
  A,
  B,
  rows,
  cols,
  equilibria,
}: {
  A: number[][];
  B: number[][];
  rows: string[];
  cols: string[];
  equilibria: Equilibrium[];
}) {
  // p = Pr(row 1), q = Pr(col 1).
  // Row player prefers row 1 when q*(A11-A21) + (1-q)*(A12-A22) > 0.
  const br1 = correspondence(A[0][0] - A[1][0] - (A[0][1] - A[1][1]), A[0][1] - A[1][1]);
  // Column player prefers col 1 when p*(B11-B12) + (1-p)*(B21-B22) > 0.
  const br2 = correspondence(B[0][0] - B[0][1] - (B[1][0] - B[1][1]), B[1][0] - B[1][1]);

  // br1 is a path in (t = q, value = p); swap into (p, q) space. br2 is in (t = p, value = q).
  const line1 = br1.path.map(([p, q]): Pt => [X(p), Y(q)]);
  const line2 = br2.path.map(([q, p]): Pt => [X(p), Y(q)]);
  const d = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[26rem]" role="img" aria-label="Best-response curves of both players. Equilibria are where the curves cross.">
        <rect x={PL} y={PT} width={INNER} height={INNER} className="fill-card stroke-rule" strokeWidth={1} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={X(t)} x2={X(t)} y1={PT} y2={PT + INNER} className="stroke-border" strokeWidth={t === 0 || t === 1 ? 0 : 1} />
            <line x1={PL} x2={PL + INNER} y1={Y(t)} y2={Y(t)} className="stroke-border" strokeWidth={t === 0 || t === 1 ? 0 : 1} />
            <text x={X(t)} y={PT + INNER + 17} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
              {t}
            </text>
            <text x={PL - 10} y={Y(t) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
              {t}
            </text>
          </g>
        ))}
        <text x={PL + INNER / 2} y={H - 6} textAnchor="middle" className="fill-foreground font-mono text-[10px] uppercase tracking-widest">
          P(row player plays {rows[0]})
        </text>
        <text transform={`translate(11 ${PT + INNER / 2}) rotate(-90)`} textAnchor="middle" className="fill-signal-ink font-mono text-[10px] uppercase tracking-widest">
          P(column player plays {cols[0]})
        </text>

        {br1.indifferent && <rect x={PL} y={PT} width={INNER} height={INNER} className="fill-foreground/5" />}
        {br2.indifferent && <rect x={PL} y={PT} width={INNER} height={INNER} className="fill-signal/10" />}
        {!br1.indifferent && <path d={d(line1)} fill="none" className="stroke-foreground" strokeWidth={3} strokeLinejoin="miter" />}
        {!br2.indifferent && <path d={d(line2)} fill="none" className="stroke-signal" strokeWidth={3} strokeLinejoin="miter" />}

        {equilibria.map((eq, i) => (
          <g key={i}>
            <circle cx={X(eq.x[0])} cy={Y(eq.y[0])} r={9} className="fill-background stroke-foreground" strokeWidth={2} />
            <circle cx={X(eq.x[0])} cy={Y(eq.y[0])} r={3.5} className="fill-foreground" />
            <text x={X(eq.x[0]) + (eq.x[0] > 0.8 ? -16 : 15)} y={Y(eq.y[0]) + (eq.y[0] > 0.9 ? 18 : -10)} className="fill-foreground font-mono text-[11px] font-semibold">
              {String(i + 1).padStart(2, "0")}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-5 bg-foreground" aria-hidden /> Row player&apos;s best response
        </span>
        <span className="flex items-center gap-2">
          <span className="h-[3px] w-5 bg-signal" aria-hidden /> Column player&apos;s best response
        </span>
        <span>Where the lines cross, both players are best-responding: that is an equilibrium.</span>
      </figcaption>
    </figure>
  );
}
