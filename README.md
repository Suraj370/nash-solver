# Nash Solver

Find every Nash equilibrium of a two-player game. Two solvers written from scratch (support enumeration and Lemke-Howson), a FastAPI service, and a web UI that shows the pivots and the pruned supports. Every speed claim is a measured number.

**Live:** https://nash-solver.vercel.app (API: https://nash-solver-api.onrender.com, free tier, so the first request after idle can take up to a minute)

```
solver/       Python package: games, checker, both algorithms, tests
api/          FastAPI service exposing /solve, /presets, /benchmarks
web/          Next.js + shadcn/ui front end
benchmarks/   Seeded benchmark harness and recorded results
```

## Run it

```bash
cd api && uv run uvicorn app.main:app --port 8000
```

```bash
cd web && pnpm install && pnpm dev
```

Open http://localhost:3000. The web app reads `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

## Deploy

The API ships as a Docker image (built from the repo root) and the web app deploys separately.

1. **API on Render.** New > Blueprint, pick this repo (`render.yaml`). After the first deploy, set `CORS_ORIGINS` to the web app's URL.
2. **Web on Vercel.** Import the repo, set the root directory to `web`, and add `NEXT_PUBLIC_API_URL` set to the Render URL. It is read at build time, so redeploy after changing it.

The free Render tier sleeps after about 15 minutes idle, so the first request can take up to a minute.

## Test and benchmark

```bash
cd solver && uv run pytest
cd api && uv run pytest
cd benchmarks && uv run --project ../solver python run.py
```

## Method

The support enumeration solver exists in six versions, so each optimization is measured against the step before it. v2 was profiled first: the batched determinant and the augmented systems took over half its time, which is what v3 removes.

| Version | Change | Effect (random games) |
|---|---|---|
| v0 | Naive: solve both indifference systems for every support pair | baseline |
| v1 | Early exit: solve the column mix first, skip the rest when it fails | 1.8x at 7x7 |
| v2 | Batched: solve every system of one support size in a few numpy calls | 7.6x at 7x7 |
| v3 | Smaller k x k systems, no determinant pass, lazy second solve | 4.0x at 10x10 |
| v4 | Cache the support index arrays | 1.07x at 10x10 |
| v5 | Delete strictly dominated strategies first | 1.03x on random games, 138x when half the strategies are dominated |

v0 to v5 is 43x at 7x7. The weak steps are reported too: v4 is a small win and v5 is nearly free on random games because they rarely have dominated strategies. Every solver is timed on the same game back to back so machine drift cannot favour one. Full tables are in `benchmarks/results/RESULTS.md`.

Lemke-Howson pivots along one path of a polytope, with a lexicographic ratio test so degenerate games cannot cycle.

Every returned equilibrium is re-checked by an independent best-response test. Tests compare all six support versions on random games, check Lemke-Howson results are a subset of the full set, and assert the count of equilibria is odd, which holds for every generic game.

## Limits

Support enumeration is exponential and assumes nondegenerate games. Lemke-Howson handles degeneracy but returns one equilibrium per path. Matrices are capped at 8x8.
