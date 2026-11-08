"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, getBenchmarks } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { BenchRow, Benchmarks } from "@/lib/types";

const W = 760;
const H = 380;
const M = { top: 20, right: 176, bottom: 44, left: 62 };

type Style = { stroke: string; dash?: string; width: number; text: string };
const STYLES: Record<string, Style> = {
  support_v0: { stroke: "stroke-muted-foreground/70", dash: "2 5", width: 2, text: "fill-muted-foreground" },
  support_v1: { stroke: "stroke-muted-foreground", width: 2, text: "fill-muted-foreground" },
  support_v2: { stroke: "stroke-foreground/60", width: 2, text: "fill-foreground" },
  support_v5: { stroke: "stroke-foreground", width: 3.5, text: "fill-foreground" },
  lh_all: { stroke: "stroke-signal", dash: "6 4", width: 2.5, text: "fill-signal-ink" },
  lh_one: { stroke: "stroke-signal", width: 3.5, text: "fill-signal-ink" },
};
const SHORT: Record<string, string> = {
  support_v0: "Support v0 naive",
  support_v1: "Support v1 early-exit",
  support_v2: "Support v2 batched",
  support_v5: "Support v5 final",
  lh_one: "Lemke-Howson, 1 path",
  lh_all: "Lemke-Howson, all",
};

/** Each optimization, compared with the step before it. */
const LADDER: { from: string; to: string; size: number; family: "random" | "dominated"; what: string }[] = [
  { from: "support_v0", to: "support_v1", size: 7, family: "random", what: "Solve the column mix first; skip the second solve when it fails." },
  { from: "support_v1", to: "support_v2", size: 7, family: "random", what: "Batch every system of one support size into a few numpy calls." },
  { from: "support_v2", to: "support_v3", size: 10, family: "random", what: "Drop the determinant pass, solve k×k instead of (k+1)×(k+1), run the second solve only on survivors." },
  { from: "support_v3", to: "support_v4", size: 10, family: "random", what: "Cache the support index arrays between calls." },
  { from: "support_v4", to: "support_v5", size: 10, family: "random", what: "Delete strictly dominated strategies first. Random games rarely have any." },
  { from: "support_v4", to: "support_v5", size: 10, family: "dominated", what: "The same step on games where half the strategies are dominated." },
];

const ms = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3));
const times = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + "×";

type Get = (family: string, s: string, n: number) => BenchRow | undefined;

export function BenchmarkSection() {
  const [data, setData] = useState<Benchmarks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getBenchmarks()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Failed to load benchmarks"));
    return () => {
      live = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!data) return null;
    const get: Get = (family, s, n) => data.rows.find((r) => r.family === family && r.solver === s && r.size === n);
    const random = data.rows.filter((r) => r.family === "random");
    const sizes = [...new Set(random.map((r) => r.size))].sort((a, b) => a - b);
    const chartSolvers = Object.keys(SHORT).filter((s) => random.some((r) => r.solver === s));
    const values = random.filter((r) => chartSolvers.includes(r.solver)).map((r) => r.median_ms);
    const lo = 10 ** Math.floor(Math.log10(Math.min(...values)));
    const hi = 10 ** Math.ceil(Math.log10(Math.max(...values)));
    const tableSolvers = (family: string) => [...new Set(data.rows.filter((r) => r.family === family).map((r) => r.solver))];
    return { sizes, chartSolvers, get, lo, hi, tableSolvers };
  }, [data]);

  if (error) {
    return <p className="border border-rule p-5 text-sm text-muted-foreground">{error}. Start the API to load measured timings.</p>;
  }
  if (!data || !model) return <div className="h-96 animate-pulse bg-muted" aria-label="Loading benchmarks" />;

  const { sizes, chartSolvers, get, lo, hi, tableSolvers } = model;
  const last = sizes[sizes.length - 1];
  const x = (n: number) => M.left + ((n - sizes[0]) / (last - sizes[0])) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * (H - M.top - M.bottom);
  const decades: number[] = [];
  for (let d = lo; d <= hi * 1.001; d *= 10) decades.push(d);

  const v0 = get("random", "support_v0", 7);
  const v5 = get("random", "support_v5", 7);
  const dom4 = get("dominated", "support_v4", last);
  const dom5 = get("dominated", "support_v5", last);
  const lh = get("random", "lh_one", last);
  const pick = active ?? last;

  return (
    <div>
      <div className="grid gap-px border border-rule bg-rule md:grid-cols-3">
        <Stat
          big={v0 && v5 ? times(v0.median_ms / v5.median_ms) : "n/a"}
          caption={v0 && v5 ? `Naive to final support enumeration at 7×7: ${ms(v0.median_ms)} ms down to ${ms(v5.median_ms)} ms.` : ""}
        />
        <Stat
          big={dom4 && dom5 ? times(dom4.median_ms / dom5.median_ms) : "n/a"}
          caption={`Dominance elimination at ${last}×${last} when half the strategies are dominated. On plain random games it is worth about 3%.`}
        />
        <Stat
          big={lh ? `${ms(lh.median_ms)} ms` : "n/a"}
          caption={`One Lemke-Howson path at ${last}×${last}. It finds a single equilibrium, not all of them.`}
          signal
        />
      </div>

      <div className="mt-10 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Median solve time against game size on a logarithmic axis">
          {decades.map((d) => (
            <g key={d}>
              <line x1={M.left} x2={W - M.right} y1={y(d)} y2={y(d)} className="stroke-border" />
              <text x={M.left - 10} y={y(d) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
                {d} ms
              </text>
            </g>
          ))}
          {sizes.map((n) => (
            <g key={n}>
              <line x1={x(n)} x2={x(n)} y1={M.top} y2={H - M.bottom} className={cn("stroke-border", pick === n && "stroke-rule")} strokeDasharray={pick === n ? undefined : "2 4"} />
              <text x={x(n)} y={H - M.bottom + 20} textAnchor="middle" className={cn("font-mono text-[11px]", pick === n ? "fill-foreground font-semibold" : "fill-muted-foreground")}>
                {n}×{n}
              </text>
              <rect x={x(n) - 18} y={M.top} width={36} height={H - M.top - M.bottom} fill="transparent" onMouseEnter={() => setActive(n)} onMouseLeave={() => setActive(null)} />
            </g>
          ))}
          {chartSolvers.map((s) => {
            const pts = sizes.map((n) => get("random", s, n)).filter((r): r is BenchRow => !!r);
            if (!pts.length) return null;
            const st = STYLES[s];
            const end = pts[pts.length - 1];
            return (
              <g key={s}>
                <path d={pts.map((r, i) => `${i ? "L" : "M"}${x(r.size).toFixed(1)} ${y(r.median_ms).toFixed(1)}`).join(" ")} fill="none" strokeDasharray={st.dash} strokeWidth={st.width} className={st.stroke} />
                {pts.map((r) => (
                  <circle key={r.size} cx={x(r.size)} cy={y(r.median_ms)} r={r.size === pick ? 5 : 2.5} className={cn(st.text, r.size === pick && "stroke-background")} strokeWidth={2} />
                ))}
                <text x={x(end.size) + 12} y={y(end.median_ms) + 4} stroke="var(--background)" strokeWidth={5} paintOrder="stroke" className={cn("font-mono text-[11px] font-medium", st.text)}>
                  {SHORT[s]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <h3 className="label mt-14 mb-4 text-foreground">Each optimization, measured against the step before</h3>
      <div className="overflow-x-auto border border-rule bg-card">
        <table className="num w-full min-w-[40rem] text-[13px]">
          <thead>
            <tr className="bg-muted">
              <th className="label border-b border-rule p-3 text-left">Step</th>
              <th className="label border-b border-rule p-3 text-left">What changed</th>
              <th className="label border-b border-rule p-3 text-right">Before</th>
              <th className="label border-b border-rule p-3 text-right">After</th>
              <th className="label border-b border-rule p-3 text-right">Speedup</th>
            </tr>
          </thead>
          <tbody>
            {LADDER.map((s, i) => {
              const a = get(s.family, s.from, s.size);
              const b = get(s.family, s.to, s.size);
              if (!a || !b) return null;
              const gain = a.median_ms / b.median_ms;
              return (
                <tr key={i} className="border-b border-border align-top last:border-b-0">
                  <td className="p-3 whitespace-nowrap">
                    <span className="font-semibold">
                      {s.from.replace("support_", "")} → {s.to.replace("support_", "")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {s.size}×{s.size}, {s.family}
                    </span>
                  </td>
                  <td className="max-w-md p-3 font-sans text-[13px] leading-relaxed text-muted-foreground">{s.what}</td>
                  <td className="p-3 text-right whitespace-nowrap">{ms(a.median_ms)} ms</td>
                  <td className="p-3 text-right whitespace-nowrap">{ms(b.median_ms)} ms</td>
                  <td className={cn("p-3 text-right font-semibold whitespace-nowrap", gain >= 2 ? "bg-signal text-signal-foreground" : gain < 1.1 && "text-muted-foreground")}>
                    {times(gain)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TimingTable title="Random games" family="random" solvers={tableSolvers("random")} sizes={sizes} data={data} pick={pick} get={get} />
      <TimingTable title="Dominated games" family="dominated" solvers={tableSolvers("dominated")} sizes={sizes} data={data} pick={pick} get={get} />

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Python {data.meta.python}, numpy {data.meta.numpy}, {data.meta.os}. Median of {data.meta.games_per_cell} seeded games per cell; the small number is
        p95. Every solver is timed on the same game back to back, so machine drift cannot favour one. v0 and v1 stop at 7×7 because they take seconds beyond
        that; skipped is not a failure.
      </p>
    </div>
  );
}

function TimingTable({
  title,
  family,
  solvers,
  sizes,
  data,
  pick,
  get,
}: {
  title: string;
  family: string;
  solvers: string[];
  sizes: number[];
  data: Benchmarks;
  pick: number;
  get: Get;
}) {
  return (
    <>
      <h3 className="label mt-14 mb-4 text-foreground">{title}, ms (median, p95)</h3>
      <div className="overflow-x-auto border border-rule bg-card">
        <table className="num w-full min-w-max text-[13px]">
          <caption className="sr-only">{title}: median and p95 solve time in milliseconds by solver and game size</caption>
          <thead>
            <tr className="bg-muted">
              <th className="label border-r border-b border-rule p-3 text-left">Solver</th>
              {sizes.map((n) => (
                <th key={n} scope="col" className={cn("label border-b border-rule p-3 text-right text-foreground", pick === n && "bg-signal-soft")}>
                  {n}×{n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {solvers.map((s) => (
              <tr key={s} className="border-b border-border last:border-b-0">
                <th scope="row" className="border-r border-rule p-3 text-left font-sans text-[13px] font-medium whitespace-nowrap">
                  {data.rows.find((r) => r.solver === s)?.label}
                </th>
                {sizes.map((n) => {
                  const r = get(family, s, n);
                  return (
                    <td key={n} className={cn("p-3 text-right whitespace-nowrap", pick === n && "bg-signal-soft")}>
                      {r ? (
                        <>
                          <span className="font-semibold">{ms(r.median_ms)}</span>
                          <span className="ml-1.5 text-muted-foreground">{ms(r.p95_ms)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/60">skipped</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ big, caption, signal }: { big: string; caption: string; signal?: boolean }) {
  return (
    <div className="bg-background p-6">
      <p className={cn("num text-5xl leading-none font-semibold tracking-tight", signal && "text-signal-ink")}>{big}</p>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}
