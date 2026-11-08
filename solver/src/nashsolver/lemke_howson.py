"""Lemke-Howson via complementary pivoting on a single tableau (von Stengel's formulation).

Payoffs are shifted to be strictly positive so the polytopes

    P = {x >= 0 : B^T x <= 1}      Q = {y >= 0 : A y <= 1}

are bounded. Each vertex pair (x, y) carries labels: label i (a row) is held
when x_i = 0 or (A y)_i = 1, and label m+j (a column) when y_j = 0 or
(B^T x)_j = 1. The origin holds every label; a completely labelled pair other
than the origin is an equilibrium. Dropping one label from the origin and
following the unique path of pivots reaches one.

Variable ids: 0..N-1 are x_0..x_{m-1}, y_0..y_{n-1} (id = label); N..2N-1 are
their slack partners r_0..r_{m-1}, s_0..s_{n-1}. The complement of id v is
(v + N) mod 2N, and both share label v mod N.
"""

from __future__ import annotations

import time

import numpy as np

from .game import Equilibrium, Game, make_equilibrium
from .result import SolveResult

EPS = 1e-12
MAX_PIVOTS_FACTOR = 200


class LemkeHowsonError(RuntimeError):
    pass


def _name(v: int, m: int, n: int) -> str:
    N = m + n
    if v < m:
        return f"x{v + 1}"
    if v < N:
        return f"y{v - m + 1}"
    if v < N + m:
        return f"r{v - N + 1}"
    return f"s{v - N - m + 1}"


def _positive(M: np.ndarray) -> np.ndarray:
    return M - M.min() + 1.0


def _lex_leaving_row(T: np.ndarray, col: int, N: int) -> int:
    """Lexicographic minimum-ratio test, which guarantees termination on degenerate games."""
    colvals = T[:, col]
    cand = np.flatnonzero(colvals > EPS)
    if cand.size == 0:
        raise LemkeHowsonError("unbounded ray; payoffs must be positive")
    # Compare rows of [rhs | identity columns] divided by the pivot-column entry.
    rhs = T[:, -1]
    best = cand[0]
    for r in cand[1:]:
        a = np.concatenate(([rhs[r]], T[r, N : 2 * N])) / colvals[r]
        b = np.concatenate(([rhs[best]], T[best, N : 2 * N])) / colvals[best]
        diff = a - b
        nz = np.flatnonzero(np.abs(diff) > 1e-12)
        if nz.size and diff[nz[0]] < 0:
            best = r
    return int(best)


def lemke_howson_path(
    game: Game, label: int, trace: bool = False
) -> tuple[Equilibrium, list[dict], int]:
    """Follow the Lemke-Howson path that drops ``label``. Returns (equilibrium, steps, pivots)."""
    m, n = game.m, game.n
    N = m + n
    if not 0 <= label < N:
        raise ValueError(f"label must be in [0, {N})")
    A = _positive(game.A)
    B = _positive(game.B)

    # Rows are the basic variables; columns are all 2N variables, then rhs.
    T = np.zeros((N, 2 * N + 1))
    T[:, N : 2 * N] = np.eye(N)
    T[:m, m:N] = A  # r_i + sum_j A_ij y_j = 1
    T[m:, :m] = B.T  # s_j + sum_i B_ij x_i = 1
    T[:, -1] = 1.0
    basis = list(range(N, 2 * N))  # initial basis: all slacks

    steps: list[dict] = []

    def snapshot(entering: int | None, leaving: int | None) -> None:
        if not trace:
            return
        nonbasic = [v for v in range(2 * N) if v not in basis]
        steps.append(
            {
                "entering": None if entering is None else _name(entering, m, n),
                "leaving": None if leaving is None else _name(leaving, m, n),
                "basis": [_name(v, m, n) for v in basis],
                "columns": [_name(v, m, n) for v in nonbasic],
                "rows": [[round(float(T[r, v]), 6) for v in nonbasic] for r in range(N)],
                "rhs": [round(float(T[r, -1]), 6) for r in range(N)],
            }
        )

    snapshot(None, None)
    entering = label
    pivots = 0
    limit = MAX_PIVOTS_FACTOR * N * N
    while True:
        row = _lex_leaving_row(T, entering, N)
        leaving = basis[row]
        T[row] /= T[row, entering]
        for r in range(N):
            if r != row and T[r, entering] != 0.0:
                T[r] -= T[r, entering] * T[row]
        basis[row] = entering
        pivots += 1
        snapshot(entering, leaving)
        if leaving % N == label:
            break
        entering = (leaving + N) % (2 * N)
        if pivots > limit:
            raise LemkeHowsonError("pivot limit exceeded")

    values = np.zeros(2 * N)
    for r, v in enumerate(basis):
        values[v] = T[r, -1]
    x, y = values[:m], values[m:N]
    if x.sum() <= EPS or y.sum() <= EPS:
        raise LemkeHowsonError("path ended at the artificial equilibrium")
    return make_equilibrium(game, x, y), steps, pivots


def lemke_howson(game: Game, label: int = 0, trace: bool = False) -> SolveResult:
    """One equilibrium, from the path that drops ``label``."""
    t0 = time.perf_counter()
    eq, steps, pivots = lemke_howson_path(game, label, trace)
    return SolveResult(
        algorithm="lemke_howson",
        equilibria=[eq],
        elapsed_ms=(time.perf_counter() - t0) * 1000,
        stats={"label": label, "pivots": pivots},
        trace=steps,
    )


def lemke_howson_all_labels(game: Game) -> SolveResult:
    """Run every starting label and return the distinct equilibria found.

    Not guaranteed to find all equilibria: some are unreachable from any
    label. Use support enumeration when completeness matters.
    """
    t0 = time.perf_counter()
    found: dict[tuple, Equilibrium] = {}
    per_label: list[int] = []
    for label in range(game.m + game.n):
        eq, _, pivots = lemke_howson_path(game, label)
        per_label.append(pivots)
        found.setdefault(eq.key(), eq)
    return SolveResult(
        algorithm="lemke_howson_all_labels",
        equilibria=list(found.values()),
        elapsed_ms=(time.perf_counter() - t0) * 1000,
        stats={"pivots_per_label": per_label},
    )
