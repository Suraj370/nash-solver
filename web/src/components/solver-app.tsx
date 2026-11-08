"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MatrixEditor } from "@/components/matrix-editor";
import { EquilibriaList, fmt } from "@/components/equilibria";
import { LemkeHowsonStepper } from "@/components/lh-stepper";
import { SupportExplorer } from "@/components/support-explorer";
import { BestResponsePlot } from "@/components/best-response-plot";
import { ApiError, getPresets, solve } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Algorithm, Grid, LHStep, Preset, SolveResponse, SupportAttempt } from "@/lib/types";

const DEFAULT: Preset = {
  name: "Battle of the Sexes",
  rows: ["Opera", "Football"],
  cols: ["Opera", "Football"],
  A: [[3, 0], [0, 2]],
  B: [[2, 0], [0, 3]],
  note: "Two pure equilibria and one mixed. Three in total, the odd count a generic game always has.",
};

const toGrid = (m: number[][]): Grid => m.map((r) => r.map(String));
const parseGrid = (g: Grid): number[][] | null => {
  const out: number[][] = [];
  for (const r of g) {
    const row: number[] = [];
    for (const c of r) {
      if (c.trim() === "" || !Number.isFinite(Number(c))) return null;
      row.push(Number(c));
    }
    out.push(row);
  }
  return out;
};

const ALGOS: { id: Algorithm; name: string; blurb: string; prefix: string }[] = [
  { id: "support_enumeration", name: "Support enumeration", blurb: "Tries every pair of strategy subsets. Finds all equilibria of a nondegenerate game.", prefix: "support_enumeration" },
  { id: "lemke_howson", name: "Lemke-Howson", blurb: "Follows one pivoting path. Finds a single equilibrium, fast.", prefix: "lemke_howson" },
  { id: "lemke_howson_all", name: "Lemke-Howson, all labels", blurb: "Runs one path per starting label and keeps the distinct results.", prefix: "lemke_howson_all_labels" },
];

type SolveState = { key: string | null; data?: SolveResponse; error?: string; unreachable?: boolean };

function useSolve(A: number[][] | null, B: number[][] | null, algorithm: Algorithm, label: number) {
  const key = A && B ? JSON.stringify({ A, B, algorithm, label }) : null;
  const [state, setState] = useState<SolveState>({ key: null });

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await solve(JSON.parse(key), ctrl.signal);
        setState({ key, data });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState({ key, error: e instanceof Error ? e.message : "Request failed", unreachable: e instanceof ApiError && e.unreachable });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key]);

  const fresh = state.key === key;
  return {
    data: state.data,
    error: fresh ? state.error : undefined,
    unreachable: fresh ? state.unreachable : false,
    loading: key !== null && !fresh,
    resultKey: state.key,
  };
}

export function SolverApp() {
  const [presets, setPresets] = useState<Record<string, Preset> | null>(null);
  const [presetKey, setPresetKey] = useState<string | null>("battle-of-the-sexes");
  const [rows, setRows] = useState(DEFAULT.rows);
  const [cols, setCols] = useState(DEFAULT.cols);
  const [A, setA] = useState<Grid>(toGrid(DEFAULT.A));
  const [B, setB] = useState<Grid>(toGrid(DEFAULT.B));
  const [note, setNote] = useState(DEFAULT.note);
  const [algorithm, setAlgorithm] = useState<Algorithm>("support_enumeration");
  const [label, setLabel] = useState(0);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let live = true;
    getPresets()
      .then((p) => live && setPresets(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const numA = useMemo(() => parseGrid(A), [A]);
  const numB = useMemo(() => parseGrid(B), [B]);
  const { data, error, unreachable, loading, resultKey } = useSolve(numA, numB, algorithm, label);
  const valid = numA !== null && numB !== null;

  const loadPreset = useCallback(
    (key: string) => {
      const p = presets?.[key];
      if (!p) return;
      setPresetKey(key);
      setRows(p.rows);
      setCols(p.cols);
      setA(toGrid(p.A));
      setB(toGrid(p.B));
      setNote(p.note);
      setSelected(0);
      setLabel(0);
    },
    [presets],
  );

  const edit = (which: "A" | "B", i: number, j: number, value: string) => {
    const set = which === "A" ? setA : setB;
    set((g) => g.map((r, ri) => (ri === i ? r.map((c, ci) => (ci === j ? value : c)) : r)));
    setPresetKey(null);
    setNote("Custom game.");
  };

  const resize = (m: number, n: number) => {
    const fit = (g: Grid): Grid => Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => g[i]?.[j] ?? "0"));
    setRows((r) => Array.from({ length: m }, (_, i) => r[i] ?? `R${i + 1}`));
    setCols((c) => Array.from({ length: n }, (_, j) => c[j] ?? `C${j + 1}`));
    setA(fit);
    setB(fit);
    setPresetKey(null);
    setNote("Custom game.");
    setSelected(0);
    setLabel((l) => Math.min(l, m + n - 1));
  };

  const algo = ALGOS.find((a) => a.id === algorithm)!;
  const matches = data?.algorithm.startsWith(algo.prefix) && (algorithm !== "lemke_howson" || data.algorithm === "lemke_howson");
  const result = matches ? data : undefined;
  const sel = result ? Math.min(selected, result.equilibria.length - 1) : 0;
  const highlight = result?.equilibria[sel] ? { rows: result.equilibria[sel].support1, cols: result.equilibria[sel].support2 } : null;
  const is2x2 = rows.length === 2 && cols.length === 2 && valid;
  const labels = [...rows.map((r, i) => `R${i + 1}`), ...cols.map((c, j) => `C${j + 1}`)];

  const presetItems = [
    ...Object.entries(presets ?? { "battle-of-the-sexes": DEFAULT }).map(([value, p]) => ({ value, label: p.name })),
    { value: "custom", label: "Custom" },
  ];

  return (
    <>
      <section id="solve" className="border-b border-rule">
        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
          <SectionHead index="01" title="Game" />
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <div className="space-y-8">
              <div>
                <p className="label mb-3">Preset</p>
                <Select
                  value={presetKey ?? "custom"}
                  items={presetItems}
                  onValueChange={(v) => v && v !== "custom" && loadPreset(v)}
                >
                  <SelectTrigger className="h-11 w-full rounded-none border-rule bg-card px-3 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border border-rule">
                    {presetItems.map((p) => (
                      <SelectItem key={p.value} value={p.value} disabled={p.value === "custom"}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{note}</p>
              </div>

              <div>
                <p className="label mb-3">Algorithm</p>
                <Tabs value={algorithm} onValueChange={(v) => setAlgorithm(v as Algorithm)}>
                  <TabsList className="h-auto w-full flex-col gap-0 rounded-none border border-rule bg-transparent p-0 group-data-horizontal/tabs:h-auto">
                    {ALGOS.map((a) => (
                      <TabsTrigger
                        key={a.id}
                        value={a.id}
                        className="h-11 w-full flex-none justify-start rounded-none border-0 border-b border-rule px-3 text-sm font-medium last:border-b-0 data-active:bg-foreground data-active:text-background data-active:shadow-none group-data-horizontal/tabs:h-11"
                      >
                        {a.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{algo.blurb}</p>
              </div>

              {algorithm === "lemke_howson" && (
                <div>
                  <p className="label mb-3">Dropped label</p>
                  <ToggleGroup
                    value={[String(label)]}
                    onValueChange={(v) => v.length && setLabel(Number(v[0]))}
                    className="flex-wrap gap-0"
                    spacing={0}
                  >
                    {labels.map((l, i) => (
                      <ToggleGroupItem
                        key={l}
                        value={String(i)}
                        className="num h-9 min-w-11 rounded-none border border-rule text-xs data-pressed:bg-signal data-pressed:text-signal-foreground -ml-px first:ml-0"
                      >
                        {l}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Different labels start different paths, and can end at different equilibria.
                  </p>
                </div>
              )}
            </div>

            <MatrixEditor rows={rows} cols={cols} A={A} B={B} highlight={highlight} onCell={edit} onResize={resize} />
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-card/40">
        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHead index="02" title="Equilibria" />
            <Status loading={loading} result={result} valid={valid} />
          </div>

          {error && (
            <div role="alert" className="mt-8 flex gap-3 border border-destructive p-5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="font-medium text-destructive">{error}</p>
                {unreachable && (
                  <>
                    <p className="mt-2 text-muted-foreground">
                      The solver runs as a Python API. Start it from the project root, then reload.
                    </p>
                    <pre className="num mt-3 overflow-x-auto bg-foreground p-3 text-xs text-background">
                      cd api &amp;&amp; uv run uvicorn app.main:app --port 8000
                    </pre>
                  </>
                )}
              </div>
            </div>
          )}

          {!valid && !error && (
            <p className="mt-8 border border-rule p-5 text-sm text-muted-foreground">
              Some payoffs are not numbers. Fix the cells underlined in the matrix.
            </p>
          )}

          {result && result.equilibria.length > 0 && (
            <div className="mt-8">
              <EquilibriaList
                equilibria={result.equilibria}
                rows={rows}
                cols={cols}
                selected={sel}
                onSelect={setSelected}
                stale={loading}
              />
              <Notes result={result} algorithm={algorithm} />
            </div>
          )}

          {!result && !error && valid && (
            <div className="mt-8 h-48 animate-pulse border border-border bg-muted" aria-label="Solving" />
          )}
        </div>
      </section>

      <section id="trace" className="border-b border-rule">
        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
          <SectionHead index="03" title="How it got there" />
          <div className={cn("mt-8 transition-opacity", loading && "opacity-45")}>
            {result && algorithm === "lemke_howson" && result.trace.length > 0 && (
              <LemkeHowsonStepper key={`${resultKey}`} steps={result.trace as LHStep[]} />
            )}
            {result && algorithm === "support_enumeration" && (
              <SupportExplorer
                key={`${resultKey}`}
                attempts={result.trace as SupportAttempt[]}
                truncated={result.trace_truncated}
                onPick={(r, c) => {
                  const i = result.equilibria.findIndex(
                    (e) => e.support1.join() === r.join() && e.support2.join() === c.join(),
                  );
                  if (i >= 0) setSelected(i);
                }}
              />
            )}
            {result && algorithm === "lemke_howson_all" && <PivotsPerLabel pivots={result.stats.pivots_per_label as number[]} labels={labels} />}
            {!result && <div className="h-40 border border-border bg-muted/50" />}
          </div>
        </div>
      </section>

      {is2x2 && numA && numB && result && (
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
            <SectionHead index="04" title="Best responses" />
            <div className="mt-8 grid items-start gap-10 lg:grid-cols-[26rem_1fr]">
              <BestResponsePlot A={numA} B={numB} rows={rows} cols={cols} equilibria={result.equilibria} />
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                In a 2×2 game each player&apos;s strategy is one number. The row player&apos;s best response is a step: below a critical value of the column
                player&apos;s mix they pick one row, above it the other. At the step they are indifferent and may mix. Every crossing of the two curves is a
                Nash equilibrium, so you can count them by eye.
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function SectionHead({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="num text-sm text-signal-ink">{index}</span>
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
    </div>
  );
}

function Status({ loading, result, valid }: { loading: boolean; result?: SolveResponse; valid: boolean }) {
  if (!valid) return null;
  return (
    <p className="num flex items-center gap-3 text-sm" aria-live="polite">
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {result && (
        <>
          <span>
            <span className="font-semibold">{result.equilibria.length}</span>{" "}
            <span className="text-muted-foreground">{result.equilibria.length === 1 ? "equilibrium" : "equilibria"}</span>
          </span>
          <span className="text-muted-foreground">/</span>
          <span>
            <span className="font-semibold">{fmt(result.elapsed_ms, result.elapsed_ms < 1 ? 3 : 2)}</span>{" "}
            <span className="text-muted-foreground">ms</span>
          </span>
          {typeof result.stats.supports_tried === "number" && (
            <>
              <span className="text-muted-foreground">/</span>
              <span>
                <span className="font-semibold">{result.stats.supports_tried}</span>{" "}
                <span className="text-muted-foreground">support pairs</span>
              </span>
            </>
          )}
          {typeof result.stats.pivots === "number" && (
            <>
              <span className="text-muted-foreground">/</span>
              <span>
                <span className="font-semibold">{result.stats.pivots}</span> <span className="text-muted-foreground">pivots</span>
              </span>
            </>
          )}
        </>
      )}
    </p>
  );
}

function Notes({ result, algorithm }: { result: SolveResponse; algorithm: Algorithm }) {
  const n = result.equilibria.length;
  const notes: string[] = [];
  if (algorithm === "lemke_howson") {
    notes.push("Lemke-Howson returns one equilibrium per path. Other labels, or support enumeration, may reveal more.");
  } else if (algorithm === "lemke_howson_all") {
    notes.push("Some equilibria cannot be reached from any starting label, so this may be fewer than the full set.");
  } else if (n % 2 === 0) {
    notes.push("An even count means the game is degenerate (ties in payoffs). Support enumeration assumes equal-size supports and can miss equilibria here; Lemke-Howson does not.");
  } else {
    notes.push("An odd number of equilibria is what a generic game always has.");
  }
  return (
    <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
      {notes.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function PivotsPerLabel({ pivots, labels }: { pivots: number[]; labels: string[] }) {
  const max = Math.max(...pivots, 1);
  return (
    <div>
      <p className="label mb-4">Pivots per starting label</p>
      <ul className="max-w-xl space-y-2">
        {pivots.map((p, i) => (
          <li key={i} className="grid grid-cols-[3rem_1fr_2.5rem] items-center gap-3">
            <span className="num text-sm">{labels[i]}</span>
            <span className="h-3 bg-muted" aria-hidden>
              <span className="block h-full bg-signal" style={{ width: `${(p / max) * 100}%` }} />
            </span>
            <span className="num text-right text-sm">{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Each label starts a different path. Path length varies, and two labels often arrive at the same equilibrium. The distinct endpoints are the
        results above.
      </p>
    </div>
  );
}

