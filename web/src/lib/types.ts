export type Preset = {
  name: string;
  rows: string[];
  cols: string[];
  A: number[][];
  B: number[][];
  note: string;
};

export type Algorithm = "support_enumeration" | "lemke_howson" | "lemke_howson_all";

export type Equilibrium = {
  x: number[];
  y: number[];
  payoff1: number;
  payoff2: number;
  support1: number[];
  support2: number[];
  pure: boolean;
  verified: boolean;
};

export type LHStep = {
  entering: string | null;
  leaving: string | null;
  basis: string[];
  columns: string[];
  rows: number[][];
  rhs: number[];
};

export type SupportStatus = "accepted" | "singular" | "negative" | "not_best_response";

export type SupportAttempt = {
  row_support: number[];
  col_support: number[];
  status: SupportStatus;
};

export type SolveResponse = {
  algorithm: string;
  elapsed_ms: number;
  stats: Record<string, unknown>;
  equilibria: Equilibrium[];
  pure_equilibria: number;
  trace: Array<LHStep | SupportAttempt>;
  trace_truncated: boolean;
  size: [number, number];
};

export type BenchRow = {
  family: "random" | "dominated";
  solver: string;
  label: string;
  size: number;
  games: number;
  median_ms: number;
  p95_ms: number;
  mean_equilibria: number;
};

export type Benchmarks = {
  meta: {
    python: string;
    numpy: string;
    machine: string;
    os: string;
    games_per_cell: number;
  };
  rows: BenchRow[];
};

export type Grid = string[][];
