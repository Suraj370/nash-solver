"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { SupportAttempt, SupportStatus } from "@/lib/types";

const META: Record<SupportStatus, { label: string; why: string; swatch: string }> = {
  accepted: { label: "Accepted", why: "Equilibrium", swatch: "bg-signal" },
  not_best_response: { label: "Not a best response", why: "A strategy outside the support does better", swatch: "bg-foreground" },
  negative: { label: "Negative weights", why: "Indifference system has no valid probabilities", swatch: "bg-muted-foreground/60" },
  singular: { label: "Singular", why: "Indifference system has no unique solution", swatch: "bg-border" },
};
const ORDER: SupportStatus[] = ["accepted", "not_best_response", "negative", "singular"];

const set = (s: number[]) => `{${s.map((i) => i + 1).join(",")}}`;

export function SupportExplorer({
  attempts,
  truncated,
  onPick,
}: {
  attempts: SupportAttempt[];
  truncated: boolean;
  onPick?: (rows: number[], cols: number[]) => void;
}) {
  const [filter, setFilter] = useState<SupportStatus | null>(null);
  const [hover, setHover] = useState<SupportAttempt | null>(null);

  const counts = useMemo(() => {
    const c: Record<SupportStatus, number> = { accepted: 0, not_best_response: 0, negative: 0, singular: 0 };
    for (const a of attempts) c[a.status]++;
    return c;
  }, [attempts]);

  const bySize = useMemo(() => {
    const groups = new Map<number, SupportAttempt[]>();
    for (const a of attempts) {
      const k = a.row_support.length;
      groups.set(k, [...(groups.get(k) ?? []), a]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [attempts]);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by outcome">
        {ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(filter === s ? null : s)}
            className={cn(
              "flex items-center gap-2 border border-rule px-3 py-2 text-left transition-colors hover:bg-muted",
              filter === s && "bg-foreground text-background hover:bg-foreground",
              filter && filter !== s && "opacity-50",
            )}
          >
            <span className={cn("size-2.5", META[s].swatch)} aria-hidden />
            <span className="label text-inherit">{META[s].label}</span>
            <span className="num text-sm font-semibold">{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {bySize.map(([k, group]) => (
          <div key={k} className="grid grid-cols-[4.5rem_1fr] gap-4">
            <div>
              <p className="label text-foreground">Size {k}</p>
              <p className="num mt-1.5 text-xs text-muted-foreground">{group.length} {group.length === 1 ? "pair" : "pairs"}</p>
            </div>
            <div className="flex flex-wrap gap-[3px]">
              {group.map((a, i) => {
                const dim = filter !== null && a.status !== filter;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Rows ${set(a.row_support)} columns ${set(a.col_support)}: ${META[a.status].label}`}
                    onMouseEnter={() => setHover(a)}
                    onFocus={() => setHover(a)}
                    onMouseLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                    onClick={() => a.status === "accepted" && onPick?.(a.row_support, a.col_support)}
                    className={cn(
                      "size-3 transition-opacity",
                      META[a.status].swatch,
                      dim && "opacity-15",
                      a.status === "accepted" ? "size-3.5 cursor-pointer" : "cursor-default",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-6 flex min-h-[3.25rem] items-center gap-4 border border-rule bg-card px-4 py-3 text-sm"
        aria-live="polite"
      >
        {hover ? (
          <>
            <span className={cn("size-3 shrink-0", META[hover.status].swatch)} aria-hidden />
            <span className="num">
              rows {set(hover.row_support)} × cols {set(hover.col_support)}
            </span>
            <span className="text-muted-foreground">
              {META[hover.status].label}. {META[hover.status].why}.
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Hover a square to see which support pair it is and why it passed or failed.</span>
        )}
      </div>
      {truncated && <p className="mt-3 text-xs text-muted-foreground">Showing the first 5,000 support pairs.</p>}
    </div>
  );
}
