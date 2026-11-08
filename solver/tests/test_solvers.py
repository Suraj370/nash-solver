import numpy as np
import pytest

from nashsolver import (
    PRESETS,
    Game,
    get_preset,
    is_nash,
    lemke_howson,
    lemke_howson_all_labels,
    pure_equilibria,
    random_game,
    support_enumeration,
)

VERSIONS = ["v0", "v1", "v2", "v3", "v4", "v5"]


def keys(result):
    return sorted(eq.key(6) for eq in result.equilibria)


# ---- checker ---------------------------------------------------------------


def test_is_nash_accepts_and_rejects():
    g = get_preset("matching-pennies")
    assert is_nash(g, [0.5, 0.5], [0.5, 0.5])
    assert not is_nash(g, [1, 0], [0.5, 0.5])
    assert not is_nash(g, [0.5, 0.6], [0.5, 0.5])  # not a distribution


def test_game_validation():
    with pytest.raises(ValueError):
        Game(np.zeros((2, 2)), np.zeros((2, 3)))
    with pytest.raises(ValueError):
        Game(np.array([[np.nan]]), np.array([[0.0]]))


# ---- known answers ---------------------------------------------------------

KNOWN = {
    "prisoners-dilemma": [([0, 1], [0, 1])],
    "matching-pennies": [([0.5, 0.5], [0.5, 0.5])],
    "rock-paper-scissors": [([1 / 3] * 3, [1 / 3] * 3)],
    "battle-of-the-sexes": [
        ([1, 0], [1, 0]),
        ([0, 1], [0, 1]),
        ([0.6, 0.4], [0.4, 0.6]),
    ],
    "chicken": [
        ([1, 0], [0, 1]),
        ([0, 1], [1, 0]),
        ([0.9, 0.1], [0.9, 0.1]),
    ],
    "stag-hunt": [
        ([1, 0], [1, 0]),
        ([0, 1], [0, 1]),
        ([0.75, 0.25], [0.75, 0.25]),
    ],
}


@pytest.mark.parametrize("version", VERSIONS)
@pytest.mark.parametrize("name", sorted(KNOWN))
def test_support_enumeration_known_games(name, version):
    g = get_preset(name)
    res = support_enumeration(g, version)
    expected = sorted(tuple(np.round(np.r_[x, y], 6).tolist()) for x, y in KNOWN[name])
    assert keys(res) == expected
    assert all(is_nash(g, e.x, e.y) for e in res.equilibria)


@pytest.mark.parametrize("name", sorted(PRESETS))
def test_lemke_howson_every_label_returns_valid_equilibrium(name):
    g = get_preset(name)
    for label in range(g.m + g.n):
        eq = lemke_howson(g, label).equilibria[0]
        assert is_nash(g, eq.x, eq.y), (name, label)


def test_pure_equilibria_matches_known():
    g = get_preset("battle-of-the-sexes")
    assert len(pure_equilibria(g)) == 2
    assert len(pure_equilibria(get_preset("matching-pennies"))) == 0


# ---- random games: cross-checks -------------------------------------------


@pytest.mark.parametrize("seed", range(25))
@pytest.mark.parametrize("shape", [(2, 2), (3, 3), (4, 3), (4, 4), (5, 5)])
def test_versions_agree_and_count_is_odd(shape, seed):
    g = random_game(*shape, seed=seed)
    results = {v: support_enumeration(g, v) for v in VERSIONS}
    base = keys(results["v0"])
    assert keys(results["v1"]) == base
    assert keys(results["v2"]) == base
    assert all(is_nash(g, e.x, e.y) for e in results["v0"].equilibria)
    # A generic bimatrix game has an odd number of equilibria.
    assert len(base) % 2 == 1


@pytest.mark.parametrize("seed", range(25))
@pytest.mark.parametrize("shape", [(2, 2), (3, 3), (4, 4), (5, 5), (6, 4)])
def test_lemke_howson_subset_of_support_enumeration(shape, seed):
    g = random_game(*shape, seed=seed)
    all_eq = set(keys(support_enumeration(g, "v2")))
    lh = lemke_howson_all_labels(g)
    assert lh.equilibria, "Lemke-Howson must find at least one equilibrium"
    for e in lh.equilibria:
        assert is_nash(g, e.x, e.y)
        assert e.key(6) in all_eq


def test_lemke_howson_handles_degenerate_game():
    # Identical payoffs everywhere: every strategy pair is an equilibrium.
    g = Game(np.ones((3, 3)), np.ones((3, 3)))
    for label in range(6):
        eq = lemke_howson(g, label).equilibria[0]
        assert is_nash(g, eq.x, eq.y)


def test_lemke_howson_trace_shape():
    g = get_preset("battle-of-the-sexes")
    res = lemke_howson(g, 0, trace=True)
    assert res.trace[0]["entering"] is None
    assert len(res.trace) == res.stats["pivots"] + 1
    assert res.trace[-1]["leaving"] is not None


def test_non_square_games():
    g = random_game(2, 5, seed=3)
    assert keys(support_enumeration(g, "v0")) == keys(support_enumeration(g, "v2"))
    eq = lemke_howson(g, 4).equilibria[0]
    assert is_nash(g, eq.x, eq.y)


# ---- dominance elimination -------------------------------------------------


def dominated_game(core: int, extra: int, seed: int) -> Game:
    """A random core game plus ``extra`` strictly dominated rows and columns."""
    rng = np.random.default_rng(seed)
    n = core + extra
    A = rng.uniform(-1, 1, (n, n))
    B = rng.uniform(-1, 1, (n, n))
    for i in range(core, n):  # row i is strictly worse than a core row for the row player
        A[i] = A[rng.integers(core)] - rng.uniform(0.1, 1.0, n)
    for j in range(core, n):  # column j is strictly worse than a core column for the column player
        B[:, j] = B[:, rng.integers(core)] - rng.uniform(0.1, 1.0, n)
    return Game(A, B)


@pytest.mark.parametrize("seed", range(20))
def test_dominance_version_matches_naive_when_strategies_are_dominated(seed):
    from nashsolver.support import dominance_reduce

    g = dominated_game(3, 2, seed)
    reduced, rows, cols = dominance_reduce(g)
    assert reduced.m < g.m and reduced.n < g.n
    assert keys(support_enumeration(g, "v0")) == keys(support_enumeration(g, "v5"))


def test_dominance_reduce_known_case():
    from nashsolver.support import dominance_reduce

    reduced, rows, cols = dominance_reduce(get_preset("prisoners-dilemma"))
    assert (reduced.m, reduced.n) == (1, 1)
    assert rows.tolist() == [1] and cols.tolist() == [1]
