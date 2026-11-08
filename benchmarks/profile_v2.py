"""Where does support_enumeration v2 spend its time? Run: uv run --project ../solver python profile_v2.py"""
import cProfile
import pstats
import sys

from nashsolver import random_game, support_enumeration

size = int(sys.argv[1]) if len(sys.argv) > 1 else 8
games = [random_game(size, size, seed=s) for s in range(5)]
support_enumeration(games[0], "v2")  # warm-up

pr = cProfile.Profile()
pr.enable()
for g in games:
    support_enumeration(g, "v2")
pr.disable()
pstats.Stats(pr).sort_stats("cumulative").print_stats(14)
