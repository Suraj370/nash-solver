"""Game representation and the equilibrium checker everything else is tested against."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

TOL = 1e-9


@dataclass(frozen=True)
class Game:
    """A two-player normal-form (bimatrix) game.

    ``A[i, j]`` is the row player's payoff and ``B[i, j]`` the column
    player's payoff when row ``i`` meets column ``j``.
    """

    A: np.ndarray
    B: np.ndarray
    name: str = ""

    def __post_init__(self) -> None:
        A = np.asarray(self.A, dtype=float)
        B = np.asarray(self.B, dtype=float)
        if A.ndim != 2 or A.shape != B.shape:
            raise ValueError("A and B must be 2-D arrays of the same shape")
        if A.size == 0:
            raise ValueError("game must have at least one row and one column")
        if not (np.isfinite(A).all() and np.isfinite(B).all()):
            raise ValueError("payoffs must be finite")
        object.__setattr__(self, "A", A)
        object.__setattr__(self, "B", B)

    @property
    def m(self) -> int:
        return self.A.shape[0]

    @property
    def n(self) -> int:
        return self.A.shape[1]


@dataclass(frozen=True)
class Equilibrium:
    x: np.ndarray  # row player's mixed strategy
    y: np.ndarray  # column player's mixed strategy
    payoff1: float
    payoff2: float
    support1: tuple[int, ...] = field(default=())
    support2: tuple[int, ...] = field(default=())

    @property
    def is_pure(self) -> bool:
        return len(self.support1) == 1 and len(self.support2) == 1

    def key(self, decimals: int = 7) -> tuple[float, ...]:
        # +0.0 normalises negative zero so equal strategies hash equally.
        return tuple((np.round(np.concatenate([self.x, self.y]), decimals) + 0.0).tolist())


def make_equilibrium(game: Game, x: np.ndarray, y: np.ndarray, tol: float = 1e-7) -> Equilibrium:
    x = np.where(np.abs(x) < tol, 0.0, x)
    y = np.where(np.abs(y) < tol, 0.0, y)
    x = x / x.sum()
    y = y / y.sum()
    return Equilibrium(
        x=x,
        y=y,
        payoff1=float(x @ game.A @ y),
        payoff2=float(x @ game.B @ y),
        support1=tuple(int(i) for i in np.flatnonzero(x > 0)),
        support2=tuple(int(j) for j in np.flatnonzero(y > 0)),
    )


def is_nash(game: Game, x: np.ndarray, y: np.ndarray, tol: float = 1e-7) -> bool:
    """True if neither player can gain by a unilateral deviation.

    Checks that x and y are probability vectors and that every pure strategy
    in each support is a best response (equivalently: no pure strategy beats
    the current payoff, which is enough because mixed deviations are convex
    combinations of pure ones).
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    if x.shape != (game.m,) or y.shape != (game.n,):
        return False
    if (x < -tol).any() or (y < -tol).any():
        return False
    if abs(x.sum() - 1) > tol or abs(y.sum() - 1) > tol:
        return False
    u1 = x @ game.A @ y
    u2 = x @ game.B @ y
    if (game.A @ y).max() > u1 + tol:
        return False
    if (x @ game.B).max() > u2 + tol:
        return False
    return True


def pure_equilibria(game: Game, tol: float = TOL) -> list[Equilibrium]:
    """All pure-strategy equilibria by checking best responses cell by cell. O(mn)."""
    col_max = game.A.max(axis=0)  # best payoff for row player against each column
    row_max = game.B.max(axis=1)  # best payoff for column player against each row
    found: list[Equilibrium] = []
    for i in range(game.m):
        for j in range(game.n):
            if game.A[i, j] >= col_max[j] - tol and game.B[i, j] >= row_max[i] - tol:
                x = np.zeros(game.m)
                y = np.zeros(game.n)
                x[i] = 1.0
                y[j] = 1.0
                found.append(make_equilibrium(game, x, y))
    return found
