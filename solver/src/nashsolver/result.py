from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .game import Equilibrium


@dataclass
class SolveResult:
    algorithm: str
    equilibria: list[Equilibrium]
    elapsed_ms: float
    stats: dict[str, Any] = field(default_factory=dict)
    trace: list[dict[str, Any]] = field(default_factory=list)
    trace_truncated: bool = False
