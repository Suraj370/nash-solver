"""Textbook games with known equilibria, used by tests, benchmarks and the web UI."""

from __future__ import annotations

import numpy as np

from .game import Game

PRESETS: dict[str, dict] = {
    "prisoners-dilemma": {
        "name": "Prisoner's Dilemma",
        "rows": ["Cooperate", "Defect"],
        "cols": ["Cooperate", "Defect"],
        "A": [[-1, -10], [0, -5]],
        "B": [[-1, 0], [-10, -5]],
        "note": "Defect strictly dominates. One equilibrium, and both players are worse off for it.",
    },
    "matching-pennies": {
        "name": "Matching Pennies",
        "rows": ["Heads", "Tails"],
        "cols": ["Heads", "Tails"],
        "A": [[1, -1], [-1, 1]],
        "B": [[-1, 1], [1, -1]],
        "note": "Zero-sum with no pure equilibrium. The only equilibrium mixes 50/50.",
    },
    "battle-of-the-sexes": {
        "name": "Battle of the Sexes",
        "rows": ["Opera", "Football"],
        "cols": ["Opera", "Football"],
        "A": [[3, 0], [0, 2]],
        "B": [[2, 0], [0, 3]],
        "note": "Two pure equilibria and one mixed. Three in total, the odd count a generic game always has.",
    },
    "rock-paper-scissors": {
        "name": "Rock-Paper-Scissors",
        "rows": ["Rock", "Paper", "Scissors"],
        "cols": ["Rock", "Paper", "Scissors"],
        "A": [[0, -1, 1], [1, 0, -1], [-1, 1, 0]],
        "B": [[0, 1, -1], [-1, 0, 1], [1, -1, 0]],
        "note": "Symmetric zero-sum. The unique equilibrium plays each move with probability 1/3.",
    },
    "chicken": {
        "name": "Chicken",
        "rows": ["Swerve", "Straight"],
        "cols": ["Swerve", "Straight"],
        "A": [[0, -1], [1, -10]],
        "B": [[0, 1], [-1, -10]],
        "note": "Two asymmetric pure equilibria plus a mixed one.",
    },
    "stag-hunt": {
        "name": "Stag Hunt",
        "rows": ["Stag", "Hare"],
        "cols": ["Stag", "Hare"],
        "A": [[4, 0], [3, 3]],
        "B": [[4, 3], [0, 3]],
        "note": "Payoff-dominant (Stag, Stag) versus risk-dominant (Hare, Hare), plus a mixed equilibrium.",
    },
    "dominance-3x3": {
        "name": "3x3 with a dominated row",
        "rows": ["Top", "Middle", "Bottom"],
        "cols": ["Left", "Center", "Right"],
        "A": [[3, 0, 2], [0, 3, 2], [1, 1, 1]],
        "B": [[3, 0, 1], [0, 3, 1], [2, 2, 1]],
        "note": "Bottom row is strictly dominated. A good example for the step-by-step views.",
    },
}


def get_preset(key: str) -> Game:
    p = PRESETS[key]
    return Game(np.array(p["A"], dtype=float), np.array(p["B"], dtype=float), name=p["name"])


def random_game(m: int, n: int, seed: int | None = None) -> Game:
    """Uniform random payoffs. Generic (nondegenerate) with probability 1."""
    rng = np.random.default_rng(seed)
    return Game(rng.uniform(-1, 1, (m, n)), rng.uniform(-1, 1, (m, n)), name=f"random-{m}x{n}")
