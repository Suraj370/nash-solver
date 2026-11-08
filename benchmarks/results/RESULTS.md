# Benchmark results

Python 3.14.2, numpy 2.5.4, Windows-11-10.0.26200-SP0. Median of 20 seeded games per cell, in milliseconds (lower is better).

## Random games

| Solver | 2x2 | 3x3 | 4x4 | 5x5 | 6x6 | 7x7 | 8x8 | 9x9 | 10x10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Support v0 naive | 0.19 | 0.52 | 1.75 | 5.75 | 20.64 | 77.36 | n/a | n/a | n/a |
| Support v1 early exit | 0.14 | 0.39 | 1.15 | 3.44 | 12.07 | 43.60 | n/a | n/a | n/a |
| Support v2 batched | 0.21 | 0.32 | 0.52 | 0.78 | 1.82 | 5.76 | 25.12 | 101.95 | 422.94 |
| Support v3 smaller systems, lazy second solve | 0.16 | 0.27 | 0.35 | 0.51 | 0.84 | 2.04 | 7.22 | 26.54 | 105.93 |
| Support v4 cached indices | 0.12 | 0.21 | 0.29 | 0.43 | 0.72 | 1.82 | 6.34 | 24.75 | 98.59 |
| Support v5 dominance elimination | 0.19 | 0.29 | 0.35 | 0.48 | 0.73 | 1.79 | 6.47 | 24.06 | 95.39 |
| Lemke-Howson, one path | 0.07 | 0.09 | 0.16 | 0.20 | 0.23 | 0.23 | 0.46 | 0.47 | 0.55 |
| Lemke-Howson, all paths | 0.27 | 0.53 | 1.15 | 2.07 | 3.17 | 4.03 | 6.93 | 9.54 | 12.33 |

## Dominated games

| Solver | 2x2 | 3x3 | 4x4 | 5x5 | 6x6 | 7x7 | 8x8 | 9x9 | 10x10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Support v2 batched | 0.18 | 0.29 | 0.39 | 0.75 | 1.78 | 5.20 | 22.21 | 95.09 | 430.26 |
| Support v4 cached indices | 0.11 | 0.18 | 0.21 | 0.35 | 0.65 | 1.50 | 5.13 | 20.85 | 93.62 |
| Support v5 dominance elimination | 0.16 | 0.19 | 0.20 | 0.28 | 0.35 | 0.41 | 0.42 | 0.63 | 0.68 |

## Speedup over the previous step (random games)

| Step | Compared at | Before | After | Speedup |
|---|---|---:|---:|---:|
| v0 to v1 | 7x7 | 77.36 ms | 43.60 ms | 1.77x |
| v1 to v2 | 7x7 | 43.60 ms | 5.76 ms | 7.57x |
| v2 to v3 | 10x10 | 422.94 ms | 105.93 ms | 3.99x |
| v3 to v4 | 10x10 | 105.93 ms | 98.59 ms | 1.07x |
| v4 to v5 | 10x10 | 98.59 ms | 95.39 ms | 1.03x |
| **v0 to v5, total** | 7x7 | 77.36 ms | 1.79 ms | **43.1x** |

## Dominance elimination on dominated games

| Size | v4 | v5 | Speedup |
|---|---:|---:|---:|
| 2x2 | 0.11 ms | 0.16 ms | 0.71x |
| 3x3 | 0.18 ms | 0.19 ms | 0.96x |
| 4x4 | 0.21 ms | 0.20 ms | 1.08x |
| 5x5 | 0.35 ms | 0.28 ms | 1.25x |
| 6x6 | 0.65 ms | 0.35 ms | 1.88x |
| 7x7 | 1.50 ms | 0.41 ms | 3.67x |
| 8x8 | 5.13 ms | 0.42 ms | 12.12x |
| 9x9 | 20.85 ms | 0.63 ms | 33.26x |
| 10x10 | 93.62 ms | 0.68 ms | 137.82x |
