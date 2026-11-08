"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LHStep } from "@/lib/types";

const num = (v: number) => (v === 0 ? "0" : Number.isInteger(v) ? String(v) : v.toFixed(3));

function caption(step: LHStep, i: number, total: number) {
  if (i === 0) return "Start at the artificial equilibrium. Every slack variable is basic, x = y = 0, and every label is held.";
  const last = i === total - 1;
  return last
    ? `${step.entering} enters, ${step.leaving} leaves. ${step.leaving} carries the dropped label, so the path ends here: every label is held and this vertex pair is an equilibrium.`
    : `${step.entering} enters, ${step.leaving} leaves. The complement of ${step.leaving} enters next, so the label that just left is picked up again.`;
}

export function LemkeHowsonStepper({ steps }: { steps: LHStep[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = steps.length;
  const at = Math.min(index, total - 1);
  const step = steps[at];

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= total - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, total]);

  const go = (n: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(total - 1, n)));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-4">
        <div className="flex items-center border border-rule">
          <Button variant="ghost" size="icon" aria-label="Restart" onClick={() => go(0)} className="size-9">
            <RotateCcw />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Previous pivot" onClick={() => go(at - 1)} disabled={at === 0} className="size-9">
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (!playing && at >= total - 1) setIndex(0);
              setPlaying((p) => !p);
            }}
            className="size-9"
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next pivot" onClick={() => go(at + 1)} disabled={at >= total - 1} className="size-9">
            <ChevronRight />
          </Button>
        </div>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={at}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Pivot"
          className="h-1 min-w-32 flex-1 cursor-pointer appearance-none bg-muted accent-signal"
        />
        <span className="num text-sm">
          <span className="font-semibold">{String(at).padStart(2, "0")}</span>
          <span className="text-muted-foreground"> / {String(total - 1).padStart(2, "0")} pivots</span>
        </span>
      </div>

      <p className="my-5 max-w-3xl text-sm leading-relaxed" aria-live="polite">
        {step.entering && (
          <span className="mr-2 inline-flex gap-1 align-baseline">
            <span className="num bg-signal px-1.5 text-signal-foreground">{step.entering} in</span>
            <span className="num bg-foreground px-1.5 text-background">{step.leaving} out</span>
          </span>
        )}
        {caption(step, at, total)}
      </p>

      <div className="overflow-x-auto border border-rule bg-card">
        <table className="num w-full min-w-max text-[13px]">
          <thead>
            <tr className="bg-muted">
              <th className="label border-r border-b border-rule p-2.5 text-left">Basis</th>
              {step.columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "label border-b border-rule p-2.5 text-right text-foreground",
                    c === step.leaving && "bg-foreground text-background",
                  )}
                >
                  {c}
                </th>
              ))}
              <th className="label border-b border-l border-rule p-2.5 text-right">RHS</th>
            </tr>
          </thead>
          <tbody>
            {step.basis.map((b, r) => (
              <tr key={b} className={cn("border-b border-border last:border-b-0", b === step.entering && "bg-signal-soft")}>
                <th
                  scope="row"
                  className={cn(
                    "border-r border-rule p-2.5 text-left font-semibold",
                    b === step.entering && "bg-signal text-signal-foreground",
                  )}
                >
                  {b}
                </th>
                {step.rows[r].map((v, c) => (
                  <td
                    key={c}
                    className={cn(
                      "p-2.5 text-right",
                      v === 0 && "text-muted-foreground/60",
                      step.columns[c] === step.leaving && "bg-muted",
                    )}
                  >
                    {num(v)}
                  </td>
                ))}
                <td className="border-l border-rule p-2.5 text-right font-semibold">{num(step.rhs[r])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Payoffs are shifted to be positive so the polytopes are bounded; equilibria are unchanged. x and y values are read from the basis rows and
        normalised to probabilities.
      </p>
    </div>
  );
}
