"""Benchmark every solver version on seeded random games.

    uv run --project ../solver python run.py
    uv run --project ../solver python run.py --max-size 10 --games 20

Two game families:
  random     uniform random payoffs (the honest default)
  dominated  half the strategies are strictly dominated (shows what dominance elimination buys)

Writes results/benchmarks.json (consumed by the web UI) and results/RESULTS.md.
Each cell is the median and p95 over N games, one run per game, after a warm-up.
"""

from __future__ import annotations

import argparse
import json
import math
import platform
import statistics
import time
from pathlib import Path

import numpy as np
from nashsolver import Game, lemke_howson_all_labels, random_game, support_enumeration
from nashsolver.lemke_howson import lemke_howson_path

OUT = Path(__file__).parent / "results"


def support(version: str):
    return lambda g: support_enumeration(g, version)


SOLVERS = {
    "support_v0": ("Support v0 naive", support("v0")),
    "support_v1": ("Support v1 early exit", support("v1")),
    "support_v2": ("Support v2 batched", support("v2")),
    "support_v3": ("Support v3 smaller systems, lazy second solve", support("v3")),
    "support_v4": ("Support v4 cached indices", support("v4")),
    "support_v5": ("Support v5 dominance elimination", support("v5")),
    "lh_one": ("Lemke-Howson, one path", lambda g: lemke_howson_path(g, 0)),
    "lh_all": ("Lemke-Howson, all paths", lambda g: lemke_howson_all_labels(g)),
}

# v0/v1 are exponential with a large constant; cap them so the run finishes.
SIZE_CAP = {"support_v0": 7, "support_v1": 7}
FAMILIES = {
    "random": list(SOLVERS),
    "dominated": ["support_v2", "support_v4", "support_v5"],
}


def dominated_game(size: int, seed: int) -> Game:
    """Random core game padded with strictly dominated rows and columns up to ``size``."""
    core = max(1, math.ceil(size / 2))
    rng = np.random.default_rng(seed)
    A = rng.uniform(-1, 1, (size, size))
    B = rng.uniform(-1, 1, (size, size))
    for i in range(core, size):
        A[i] = A[rng.integers(core)] - rng.uniform(0.1, 1.0, size)
    for j in range(core, size):
        B[:, j] = B[:, rng.integers(core)] - rng.uniform(0.1, 1.0, size)
    return Game(A, B)


def make_game(family: str, size: int, seed: int) -> Game:
    return random_game(size, size, seed=seed) if family == "random" else dominated_game(size, seed)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-size", type=int, default=10)
    ap.add_argument("--games", type=int, default=20)
    args = ap.parse_args()

    sizes = list(range(2, args.max_size + 1))
    rows = []
    for _, fn in SOLVERS.values():  # warm-up so numpy/BLAS init is not charged to the first cell
        fn(random_game(3, 3, seed=0))

    # For each game, time every solver back to back (rotating the order) so machine
    # drift between solvers cannot favour whichever one happened to run in a quiet moment.
    for family, keys in FAMILIES.items():
        for size in sizes:
            active = [k for k in keys if size <= SIZE_CAP.get(k, 99)]
            times = {k: [] for k in active}
            counts = {k: [] for k in active}
            for seed in range(args.games):
                g = make_game(family, size, seed)
                shift = seed % len(active)
                for key in active[shift:] + active[:shift]:
                    t0 = time.perf_counter()
                    res = SOLVERS[key][1](g)
                    times[key].append((time.perf_counter() - t0) * 1000)
                    counts[key].append(len(res.equilibria) if hasattr(res, "equilibria") else 1)
            for key in active:
                row = {
                    "family": family,
                    "solver": key,
                    "label": SOLVERS[key][0],
                    "size": size,
                    "games": args.games,
                    "median_ms": round(statistics.median(times[key]), 4),
                    "p95_ms": round(float(np.percentile(times[key], 95)), 4),
                    "mean_equilibria": round(statistics.mean(counts[key]), 3),
                }
                rows.append(row)
                print(f"{family:9s} {key:11s} {size:2d}x{size:<2d} median {row['median_ms']:>10.3f} ms  p95 {row['p95_ms']:>10.3f} ms")

    OUT.mkdir(exist_ok=True)
    meta = {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "machine": platform.processor() or platform.machine(),
        "os": platform.platform(),
        "games_per_cell": args.games,
    }
    (OUT / "benchmarks.json").write_text(json.dumps({"meta": meta, "rows": rows}, indent=2))
    write_markdown(rows, meta, sizes)


def write_markdown(rows: list[dict], meta: dict, sizes: list[int]) -> None:
    by = {(r["family"], r["solver"], r["size"]): r for r in rows}
    lines = [
        "# Benchmark results",
        "",
        f"Python {meta['python']}, numpy {meta['numpy']}, {meta['os']}. "
        f"Median of {meta['games_per_cell']} seeded games per cell, in milliseconds (lower is better).",
    ]
    for family, keys in FAMILIES.items():
        lines += ["", f"## {family.capitalize()} games", "", "| Solver | " + " | ".join(f"{s}x{s}" for s in sizes) + " |", "|---|" + "---:|" * len(sizes)]
        for key in keys:
            cells = [f"{by[(family, key, s)]['median_ms']:.2f}" if (family, key, s) in by else "n/a" for s in sizes]
            lines.append(f"| {SOLVERS[key][0]} | " + " | ".join(cells) + " |")

    lines += ["", "## Speedup over the previous step (random games)", "", "| Step | Compared at | Before | After | Speedup |", "|---|---|---:|---:|---:|"]
    steps = [("v1", "v0", 7), ("v2", "v1", 7), ("v3", "v2", 10), ("v4", "v3", 10), ("v5", "v4", 10)]
    for new, old, s in steps:
        a, b = by.get(("random", f"support_{old}", s)), by.get(("random", f"support_{new}", s))
        if a and b:
            lines.append(f"| {old} to {new} | {s}x{s} | {a['median_ms']:.2f} ms | {b['median_ms']:.2f} ms | {a['median_ms'] / b['median_ms']:.2f}x |")
    a, b = by.get(("random", "support_v0", 7)), by.get(("random", "support_v5", 7))
    if a and b:
        lines.append(f"| **v0 to v5, total** | 7x7 | {a['median_ms']:.2f} ms | {b['median_ms']:.2f} ms | **{a['median_ms'] / b['median_ms']:.1f}x** |")
    lines += ["", "## Dominance elimination on dominated games", "", "| Size | v4 | v5 | Speedup |", "|---|---:|---:|---:|"]
    for s in sizes:
        a, b = by.get(("dominated", "support_v4", s)), by.get(("dominated", "support_v5", s))
        if a and b:
            lines.append(f"| {s}x{s} | {a['median_ms']:.2f} ms | {b['median_ms']:.2f} ms | {a['median_ms'] / b['median_ms']:.2f}x |")
    (OUT / "RESULTS.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
