"""Support enumeration, in three versions so each optimization can be measured.

* ``v0`` naive: solve both indifference systems for every pair of equal-size
  supports, then check best responses. The textbook baseline.
* ``v1`` early exit: solve the column player's mix first and bail out as soon
  as it is invalid, so the second solve and most checks are skipped.
* ``v2`` batched: build every k x k system for a support size at once, then
  solve and check them in a handful of vectorised numpy calls.

All three assume a nondegenerate game, where every equilibrium has supports of
equal size. Degenerate games may have equilibria these miss; Lemke-Howson
handles those.
"""

from __future__ import annotations

import time
from functools import lru_cache
from itertools import combinations
from typing import Callable

import numpy as np

from .game import Equilibrium, Game, make_equilibrium
from .result import SolveResult

TOL = 1e-9
MAX_TRACE = 5000


def _indifference(M: np.ndarray) -> tuple[np.ndarray, float]:
    """Solve M p = v * 1 with sum(p) = 1. Raises LinAlgError if singular."""
    k = M.shape[0]
    S = np.zeros((k + 1, k + 1))
    S[:k, :k] = M
    S[:k, k] = -1.0
    S[k, :k] = 1.0
    rhs = np.zeros(k + 1)
    rhs[k] = 1.0
    sol = np.linalg.solve(S, rhs)
    return sol[:k], float(sol[k])


def _dedupe(game: Game, found: list[Equilibrium]) -> list[Equilibrium]:
    seen: dict[tuple, Equilibrium] = {}
    for eq in found:
        seen.setdefault(eq.key(), eq)
    return list(seen.values())


def _v0(game: Game, trace: list | None, stats: dict) -> list[Equilibrium]:
    A, B, m, n = game.A, game.B, game.m, game.n
    found: list[Equilibrium] = []
    for k in range(1, min(m, n) + 1):
        for I in combinations(range(m), k):
            for J in combinations(range(n), k):
                stats["supports_tried"] += 1
                Ii, Jj = list(I), list(J)
                status = "accepted"
                try:
                    y_s, v1 = _indifference(A[np.ix_(Ii, Jj)])
                    x_s, v2 = _indifference(B[np.ix_(Ii, Jj)].T)
                except np.linalg.LinAlgError:
                    status = "singular"
                else:
                    if (y_s <= TOL).any() or (x_s <= TOL).any():
                        status = "negative"
                    else:
                        x = np.zeros(m)
                        y = np.zeros(n)
                        x[Ii] = x_s
                        y[Jj] = y_s
                        if (A @ y).max() > v1 + 1e-7 or (x @ B).max() > v2 + 1e-7:
                            status = "not_best_response"
                        else:
                            found.append(make_equilibrium(game, x, y))
                if trace is not None and len(trace) < MAX_TRACE:
                    trace.append({"row_support": list(I), "col_support": list(J), "status": status})
    return found


def _v1(game: Game, trace: list | None, stats: dict) -> list[Equilibrium]:
    A, B, m, n = game.A, game.B, game.m, game.n
    found: list[Equilibrium] = []
    for k in range(1, min(m, n) + 1):
        for I in combinations(range(m), k):
            Ii = list(I)
            for J in combinations(range(n), k):
                stats["supports_tried"] += 1
                Jj = list(J)
                status = "accepted"
                try:
                    y_s, v1 = _indifference(A[np.ix_(Ii, Jj)])
                except np.linalg.LinAlgError:
                    status = "singular"
                else:
                    if (y_s <= TOL).any():
                        status = "negative"
                    else:
                        y = np.zeros(n)
                        y[Jj] = y_s
                        if (A @ y).max() > v1 + 1e-7:
                            status = "not_best_response"
                        else:
                            try:
                                x_s, v2 = _indifference(B[np.ix_(Ii, Jj)].T)
                            except np.linalg.LinAlgError:
                                status = "singular"
                            else:
                                x = np.zeros(m)
                                x[Ii] = x_s
                                if (x_s <= TOL).any():
                                    status = "negative"
                                elif (x @ B).max() > v2 + 1e-7:
                                    status = "not_best_response"
                                else:
                                    found.append(make_equilibrium(game, x, y))
                if trace is not None and len(trace) < MAX_TRACE:
                    trace.append({"row_support": list(I), "col_support": list(J), "status": status})
    return found


def _batched_indifference(M: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Solve N systems at once. Returns (p, v, ok) where ok marks nonsingular rows."""
    N, k, _ = M.shape
    S = np.zeros((N, k + 1, k + 1))
    S[:, :k, :k] = M
    S[:, :k, k] = -1.0
    S[:, k, :k] = 1.0
    rhs = np.zeros((N, k + 1, 1))
    rhs[:, k, 0] = 1.0
    ok = np.abs(np.linalg.det(S)) > 1e-12
    sol = np.zeros((N, k + 1))
    if ok.any():
        sol[ok] = np.linalg.solve(S[ok], rhs[ok])[:, :, 0]
    return sol[:, :k], sol[:, k], ok


def _v2(game: Game, trace: list | None, stats: dict) -> list[Equilibrium]:
    A, B, m, n = game.A, game.B, game.m, game.n
    found: list[Equilibrium] = []
    for k in range(1, min(m, n) + 1):
        Is = np.array(list(combinations(range(m), k)))  # (Ca, k)
        Js = np.array(list(combinations(range(n), k)))  # (Cb, k)
        Ca, Cb = len(Is), len(Js)
        N = Ca * Cb
        stats["supports_tried"] += N
        # Index grids: pair p = a * Cb + b  ->  support Is[a], Js[b].
        a_idx = np.repeat(np.arange(Ca), Cb)
        b_idx = np.tile(np.arange(Cb), Ca)
        rows = Is[a_idx]  # (N, k)
        cols = Js[b_idx]  # (N, k)
        A_sub = A[rows[:, :, None], cols[:, None, :]]  # (N, k, k)
        B_sub = B[rows[:, :, None], cols[:, None, :]]
        y_s, v1, ok1 = _batched_indifference(A_sub)
        x_s, v2, ok2 = _batched_indifference(B_sub.transpose(0, 2, 1))
        valid = ok1 & ok2 & (y_s > TOL).all(axis=1) & (x_s > TOL).all(axis=1)
        if not valid.any():
            continue
        sel = np.flatnonzero(valid)
        Y = np.zeros((len(sel), n))
        X = np.zeros((len(sel), m))
        np.put_along_axis(Y, cols[sel], y_s[sel], axis=1)
        np.put_along_axis(X, rows[sel], x_s[sel], axis=1)
        good = ((Y @ A.T).max(axis=1) <= v1[sel] + 1e-7) & ((X @ B).max(axis=1) <= v2[sel] + 1e-7)
        for t in np.flatnonzero(good):
            found.append(make_equilibrium(game, X[t], Y[t]))
    return found


def _solve_ones(M: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Solve N systems M q = 1 at once. Returns (q, ok); ok marks usable (nonsingular, finite) rows.

    For a strictly positive payoff block, M y = v * 1 with sum(y) = 1 is the
    same as M q = 1 with y = q / sum(q) and v = 1 / sum(q). That is a k x k
    system instead of (k+1) x (k+1), with no augmented row to build.
    """
    N, k, _ = M.shape
    ones = np.ones((N, k, 1))
    try:
        q = np.linalg.solve(M, ones)[:, :, 0]
        ok = np.isfinite(q).all(axis=1)
    except np.linalg.LinAlgError:
        # Rare on generic games. Find the exactly singular blocks and solve the rest.
        good = np.abs(np.linalg.det(M)) > 1e-12
        q = np.zeros((N, k))
        if good.any():
            q[good] = np.linalg.solve(M[good], ones[good])[:, :, 0]
        ok = good & np.isfinite(q).all(axis=1)
    return q, ok


def _positive(M: np.ndarray) -> np.ndarray:
    return M - M.min() + 1.0


def _support_index(m: int, n: int, k: int) -> tuple[np.ndarray, np.ndarray]:
    """(rows, cols), each (C(m,k) * C(n,k), k): every pair of size-k supports."""
    Is = np.array(list(combinations(range(m), k)))
    Js = np.array(list(combinations(range(n), k)))
    Ca, Cb = len(Is), len(Js)
    return Is[np.repeat(np.arange(Ca), Cb)], Js[np.tile(np.arange(Cb), Ca)]


@lru_cache(maxsize=256)
def _support_index_cached(m: int, n: int, k: int) -> tuple[np.ndarray, np.ndarray]:
    rows, cols = _support_index(m, n, k)
    rows.setflags(write=False)
    cols.setflags(write=False)
    return rows, cols


def _batched_v3(game: Game, stats: dict, cached: bool) -> list[Equilibrium]:
    m, n = game.m, game.n
    A, B = _positive(game.A), _positive(game.B)
    index = _support_index_cached if cached else _support_index
    found: list[Equilibrium] = []
    for k in range(1, min(m, n) + 1):
        rows, cols = index(m, n, k)
        stats["supports_tried"] += len(rows)
        # First solve: the column player's mix, for every support pair.
        q1, ok1 = _solve_ones(A[rows[:, :, None], cols[:, None, :]])
        sel = np.flatnonzero(ok1 & (q1 > TOL).all(axis=1))
        if sel.size == 0:
            continue
        # Second solve only for the pairs that survived the first.
        r, c = rows[sel], cols[sel]
        q2, ok2 = _solve_ones(B[r[:, :, None], c[:, None, :]].transpose(0, 2, 1))
        keep = ok2 & (q2 > TOL).all(axis=1)
        if not keep.any():
            continue
        r, c, q1, q2 = r[keep], c[keep], q1[sel][keep], q2[keep]
        s1, s2 = q1.sum(axis=1), q2.sum(axis=1)  # 1/v for each player
        Y = np.zeros((len(r), n))
        X = np.zeros((len(r), m))
        np.put_along_axis(Y, c, q1 / s1[:, None], axis=1)
        np.put_along_axis(X, r, q2 / s2[:, None], axis=1)
        good = ((Y @ A.T).max(axis=1) <= 1 / s1 + 1e-7) & ((X @ B).max(axis=1) <= 1 / s2 + 1e-7)
        for t in np.flatnonzero(good):
            found.append(make_equilibrium(game, X[t], Y[t]))
    return found


def _v3(game: Game, trace: list | None, stats: dict) -> list[Equilibrium]:
    return _batched_v3(game, stats, cached=False)


def _v4(game: Game, trace: list | None, stats: dict) -> list[Equilibrium]:
    return _batched_v3(game, stats, cached=True)


def dominance_reduce(game: Game) -> tuple[Game, np.ndarray, np.ndarray]:
    """Iteratively delete strictly dominated pure strategies.

    A strictly dominated strategy is never played in any equilibrium, so
    deleting it loses nothing. Returns the reduced game and the indices of
    the rows and columns that were kept.
    """
    rows = np.arange(game.m)
    cols = np.arange(game.n)
    A, B = game.A, game.B
    changed = True
    while changed:
        changed = False
        a, b = A[np.ix_(rows, cols)], B[np.ix_(rows, cols)]
        if len(rows) > 1:
            # dom[i, i2] is True when row i2 strictly beats row i in every remaining column.
            dom = (a[None, :, :] > a[:, None, :]).all(axis=2)
            dominated = dom.any(axis=1)
            if dominated.any():
                rows = rows[~dominated] if not dominated.all() else rows
                changed = True
                continue
        if len(cols) > 1:
            dom = (b[:, None, :] > b[:, :, None]).all(axis=0)
            dominated = dom.any(axis=1)
            if dominated.any():
                cols = cols[~dominated] if not dominated.all() else cols
                changed = True
    return Game(A[np.ix_(rows, cols)], B[np.ix_(rows, cols)], name=game.name), rows, cols


def _v5(game: Game, trace: list | None, stats: dict) -> list[Equilibrium]:
    reduced, rows, cols = dominance_reduce(game)
    stats["reduced_size"] = (reduced.m, reduced.n)
    found = _batched_v3(reduced, stats, cached=True)
    lifted: list[Equilibrium] = []
    for eq in found:
        x = np.zeros(game.m)
        y = np.zeros(game.n)
        x[rows] = eq.x
        y[cols] = eq.y
        lifted.append(make_equilibrium(game, x, y))
    return lifted


VERSIONS: dict[str, Callable] = {"v0": _v0, "v1": _v1, "v2": _v2, "v3": _v3, "v4": _v4, "v5": _v5}
TRACEABLE = {"v0", "v1"}
DEFAULT_VERSION = "v5"


def support_enumeration(game: Game, version: str = DEFAULT_VERSION, trace: bool = False) -> SolveResult:
    """Find all equilibria of a nondegenerate game by enumerating supports."""
    if version not in VERSIONS:
        raise ValueError(f"unknown version {version!r}; choose from {sorted(VERSIONS)}")
    stats: dict = {"supports_tried": 0}
    steps: list | None = [] if (trace and version in TRACEABLE) else None
    t0 = time.perf_counter()
    found = VERSIONS[version](game, steps, stats)
    elapsed = (time.perf_counter() - t0) * 1000
    eqs = _dedupe(game, found)
    return SolveResult(
        algorithm=f"support_enumeration_{version}",
        equilibria=eqs,
        elapsed_ms=elapsed,
        stats={k: v for k, v in stats.items()},
        trace=steps if steps is not None else [],
        trace_truncated=bool(steps is not None and len(steps) >= MAX_TRACE),
    )
