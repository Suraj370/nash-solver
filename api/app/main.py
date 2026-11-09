from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from nashsolver import (
    PRESETS,
    Game,
    is_nash,
    lemke_howson,
    lemke_howson_all_labels,
    pure_equilibria,
    support_enumeration,
)
from nashsolver.lemke_howson import LemkeHowsonError
from pydantic import BaseModel, Field, field_validator

MAX_DIM = 8
BENCH_FILE = Path(
    os.environ.get("BENCHMARKS_FILE", Path(__file__).resolve().parents[2] / "benchmarks" / "results" / "benchmarks.json")
)

app = FastAPI(title="Nash Solver API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:3100").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class SolveRequest(BaseModel):
    A: list[list[float]]
    B: list[list[float]]
    algorithm: Literal["support_enumeration", "lemke_howson", "lemke_howson_all"] = "support_enumeration"
    label: int = Field(0, ge=0, description="Dropped label for single-path Lemke-Howson")
    trace: bool = True

    @field_validator("A", "B")
    @classmethod
    def _rectangular(cls, v: list[list[float]]) -> list[list[float]]:
        if not v or not v[0]:
            raise ValueError("matrix must not be empty")
        if len(v) > MAX_DIM or len(v[0]) > MAX_DIM:
            raise ValueError(f"matrix is limited to {MAX_DIM}x{MAX_DIM}")
        if any(len(r) != len(v[0]) for r in v):
            raise ValueError("matrix rows must have equal length")
        if any(not np.isfinite(c) for r in v for c in r):
            raise ValueError("payoffs must be finite")
        return v


def _eq_json(game: Game, eq) -> dict:
    return {
        "x": [round(float(p), 10) for p in eq.x],
        "y": [round(float(p), 10) for p in eq.y],
        "payoff1": round(eq.payoff1, 10),
        "payoff2": round(eq.payoff2, 10),
        "support1": list(eq.support1),
        "support2": list(eq.support2),
        "pure": eq.is_pure,
        "verified": is_nash(game, eq.x, eq.y),
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/presets")
def presets() -> dict:
    return PRESETS


@app.get("/benchmarks")
def benchmarks() -> dict:
    if not BENCH_FILE.exists():
        raise HTTPException(404, "benchmarks have not been generated yet")
    return json.loads(BENCH_FILE.read_text())


@app.post("/solve")
def solve(req: SolveRequest) -> dict:
    try:
        game = Game(np.array(req.A), np.array(req.B))
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    try:
        if req.algorithm == "support_enumeration":
            res = support_enumeration(game)
            # The batched versions have no per-support trace; re-run v1 for the explorer.
            if req.trace and game.m * game.n <= 64:
                traced = support_enumeration(game, "v1", trace=True)
                res.trace, res.trace_truncated = traced.trace, traced.trace_truncated
        elif req.algorithm == "lemke_howson":
            if req.label >= game.m + game.n:
                raise HTTPException(422, f"label must be below {game.m + game.n}")
            res = lemke_howson(game, req.label, trace=req.trace)
        else:
            res = lemke_howson_all_labels(game)
    except LemkeHowsonError as e:
        raise HTTPException(500, f"solver failed: {e}") from e

    return {
        "algorithm": res.algorithm,
        "elapsed_ms": round(res.elapsed_ms, 4),
        "stats": res.stats,
        "equilibria": [_eq_json(game, e) for e in res.equilibria],
        "pure_equilibria": len(pure_equilibria(game)),
        "trace": res.trace,
        "trace_truncated": res.trace_truncated,
        "size": [game.m, game.n],
    }
