"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Grid } from "@/lib/types";

export const MAX_DIM = 8;

type Props = {
  rows: string[];
  cols: string[];
  A: Grid;
  B: Grid;
  /** Cells inside the selected equilibrium's support. */
  highlight: { rows: number[]; cols: number[] } | null;
  onCell: (which: "A" | "B", i: number, j: number, value: string) => void;
  onResize: (rows: number, cols: number) => void;
};

const isNum = (s: string) => s.trim() !== "" && Number.isFinite(Number(s));

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="label w-10">{label}</span>
      <div className="flex items-center border border-rule">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${label.toLowerCase()}`}
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          className="size-8"
        >
          <Minus />
        </Button>
        <span className="num w-8 text-center text-sm font-medium">{value}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Add ${label.toLowerCase()}`}
          disabled={value >= MAX_DIM}
          onClick={() => onChange(value + 1)}
          className="size-8"
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

export function MatrixEditor({ rows, cols, A, B, highlight, onCell, onResize }: Props) {
  const template = `minmax(5.5rem,auto) repeat(${cols.length}, minmax(8.5rem, 1fr))`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Stepper label="Rows" value={rows.length} onChange={(n) => onResize(n, cols.length)} />
        <Stepper label="Cols" value={cols.length} onChange={(n) => onResize(rows.length, n)} />
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="size-2 bg-foreground" aria-hidden /> Row player
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 bg-signal" aria-hidden /> Column player
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border border-rule bg-card" role="group" aria-label="Payoff matrix">
        <div className="grid min-w-max" style={{ gridTemplateColumns: template }}>
          <div className="label border-r border-b border-rule bg-muted p-3 text-right">
            <span className="block">Row ↓</span>
            <span className="mt-1.5 block">Col →</span>
          </div>
          {cols.map((c, j) => (
            <div
              key={`c${j}`}
              className={cn(
                "label border-b border-rule bg-muted p-3 text-center text-foreground",
                j < cols.length - 1 && "border-r",
              )}
            >
              <span className="text-muted-foreground">{j + 1} </span>
              {c}
            </div>
          ))}

          {rows.map((r, i) => (
            <Row
              key={`r${i}`}
              i={i}
              name={r}
              last={i === rows.length - 1}
              cols={cols.length}
              A={A[i]}
              B={B[i]}
              highlightRow={highlight?.rows.includes(i) ?? false}
              highlightCols={highlight?.cols ?? []}
              onCell={onCell}
            />
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Each cell is <span className="num text-foreground">row payoff</span> /{" "}
        <span className="num text-signal-ink">column payoff</span>. Tab moves across the matrix.
      </p>
    </div>
  );
}

function Row({
  i,
  name,
  last,
  cols,
  A,
  B,
  highlightRow,
  highlightCols,
  onCell,
}: {
  i: number;
  name: string;
  last: boolean;
  cols: number;
  A: string[];
  B: string[];
  highlightRow: boolean;
  highlightCols: number[];
  onCell: Props["onCell"];
}) {
  return (
    <>
      <div
        className={cn(
          "label flex items-center justify-end border-r border-rule bg-muted p-3 text-right text-foreground",
          !last && "border-b",
        )}
      >
        <span className="mr-1.5 text-muted-foreground">{i + 1}</span>
        {name}
      </div>
      {Array.from({ length: cols }, (_, j) => {
        const active = highlightRow && highlightCols.includes(j);
        return (
          <div
            key={j}
            className={cn(
              "relative flex items-stretch border-border transition-colors",
              !last && "border-b",
              j < cols - 1 && "border-r",
              active && "bg-signal-soft",
            )}
          >
            {active && <span aria-hidden className="absolute inset-0 border-2 border-signal" />}
            <input
              className="cell-input"
              inputMode="decimal"
              aria-label={`Row ${i + 1}, column ${j + 1}, row player payoff`}
              aria-invalid={!isNum(A[j])}
              value={A[j]}
              onChange={(e) => onCell("A", i, j, e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
            <span aria-hidden className="self-center text-muted-foreground">
              /
            </span>
            <input
              className="cell-input text-signal-ink"
              inputMode="decimal"
              aria-label={`Row ${i + 1}, column ${j + 1}, column player payoff`}
              aria-invalid={!isNum(B[j])}
              value={B[j]}
              onChange={(e) => onCell("B", i, j, e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        );
      })}
    </>
  );
}
