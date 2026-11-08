"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Equilibrium } from "@/lib/types";

export const fmt = (v: number, d = 3) => {
  const r = Math.abs(v) < 5 * 10 ** -(d + 1) ? 0 : v;
  return r.toFixed(d);
};

function Bars({
  names,
  probs,
  tone,
}: {
  names: string[];
  probs: number[];
  tone: "ink" | "signal";
}) {
  return (
    <ul className="space-y-1.5">
      {probs.map((p, i) => (
        <li key={i} className="grid grid-cols-[6.5rem_1fr_3.75rem] items-center gap-3">
          <span className={cn("truncate text-[13px]", p === 0 && "text-muted-foreground")}>{names[i]}</span>
          <span className="relative h-2.5 bg-muted" aria-hidden>
            <span
              className={cn("absolute inset-y-0 left-0", tone === "ink" ? "bg-foreground" : "bg-signal")}
              style={{ width: `${p * 100}%` }}
            />
          </span>
          <span className={cn("num text-right text-[13px]", p === 0 && "text-muted-foreground")}>{fmt(p)}</span>
        </li>
      ))}
    </ul>
  );
}

export function EquilibriaList({
  equilibria,
  rows,
  cols,
  selected,
  onSelect,
  stale,
}: {
  equilibria: Equilibrium[];
  rows: string[];
  cols: string[];
  selected: number;
  onSelect: (i: number) => void;
  stale: boolean;
}) {
  return (
    <ol className={cn("border-t border-rule transition-opacity", stale && "opacity-45")} aria-busy={stale}>
      {equilibria.map((eq, i) => {
        const active = i === selected;
        return (
          <li key={i} className="border-b border-rule">
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-pressed={active}
              className={cn(
                "grid w-full gap-x-10 gap-y-5 p-5 text-left transition-colors md:grid-cols-[7rem_1fr_1fr_10rem]",
                active ? "bg-signal-soft" : "hover:bg-muted",
              )}
            >
              <div className="flex items-start justify-between gap-3 md:block">
                <span className="num text-4xl leading-none font-semibold tracking-tight">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "label mt-0 inline-block border px-1.5 py-1 md:mt-3",
                    eq.pure ? "border-foreground text-foreground" : "border-signal text-signal-ink",
                  )}
                >
                  {eq.pure ? "Pure" : "Mixed"}
                </span>
              </div>
              <div>
                <p className="label mb-3 text-foreground">Row player</p>
                <Bars names={rows} probs={eq.x} tone="ink" />
              </div>
              <div>
                <p className="label mb-3 text-signal-ink">Column player</p>
                <Bars names={cols} probs={eq.y} tone="signal" />
              </div>
              <dl className="grid grid-cols-2 content-start gap-3 md:grid-cols-1">
                <div>
                  <dt className="label">Row payoff</dt>
                  <dd className="num mt-1.5 text-lg">{fmt(eq.payoff1)}</dd>
                </div>
                <div>
                  <dt className="label">Column payoff</dt>
                  <dd className="num mt-1.5 text-lg text-signal-ink">{fmt(eq.payoff2)}</dd>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <dt className="sr-only">Verification</dt>
                  <dd
                    className={cn(
                      "label flex items-center gap-1.5",
                      eq.verified ? "text-foreground" : "text-destructive",
                    )}
                  >
                    <Check className="size-3.5" aria-hidden />
                    {eq.verified ? "Verified" : "Failed check"}
                  </dd>
                </div>
              </dl>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
