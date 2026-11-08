import { BenchmarkSection } from "@/components/benchmarks";
import { SolverApp } from "@/components/solver-app";

const NAV = [
  ["Solver", "#solve"],
  ["Trace", "#trace"],
  ["Benchmarks", "#benchmarks"],
  ["Method", "#method"],
] as const;

const STEPS = [
  {
    tag: "v0",
    name: "Naive loop",
    body: "For every pair of equal-size supports, solve both indifference systems with numpy, then check best responses. Correct, simple, and the baseline every other number is measured against.",
  },
  {
    tag: "v1",
    name: "Early exit",
    body: "Solve the column player's mix first. If it has a negative weight or fails the best-response check, skip the second solve. Most support pairs die at the first test, so most of the linear algebra never runs.",
  },
  {
    tag: "v2",
    name: "Batched",
    body: "For each support size, build every system as one stacked array, filter singular ones with a batched determinant, and solve and check all survivors in a few vectorised numpy calls. The Python loop disappears.",
  },
  {
    tag: "v3–v5",
    name: "Profile, then trim",
    body: "Profiling v2 showed the determinant pass and the augmented systems took over half the time. v3 solves smaller k×k systems and runs the second solve only on survivors; v4 caches index arrays; v5 deletes strictly dominated strategies first. Each step is measured below, including the ones that barely helped.",
  },
  {
    tag: "LH",
    name: "Lemke-Howson",
    body: "A different idea entirely: pivot along one path of a polytope instead of enumerating. Polynomial work per step, one equilibrium per starting label, and a lexicographic ratio test so degenerate games cannot cycle.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-rule bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-5 md:px-8">
          <a href="#" className="flex items-center gap-2.5 font-mono text-sm font-semibold tracking-tight">
            <span className="grid size-5 grid-cols-2 grid-rows-2 gap-px bg-foreground p-px" aria-hidden>
              <span className="bg-background" />
              <span className="bg-signal" />
              <span className="bg-signal" />
              <span className="bg-background" />
            </span>
            NASH/SOLVER
          </a>
          <nav aria-label="Sections" className="flex items-center gap-5 md:gap-7">
            {NAV.map(([name, href]) => (
              <a key={href} href={href} className="label hidden text-foreground/70 transition-colors hover:text-signal-ink sm:inline">
                {name}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[1280px] px-5 pt-16 pb-14 md:px-8 md:pt-24 md:pb-20">
            <p className="label mb-6 text-signal-ink">Two-player normal-form games</p>
            <h1 className="max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-balance">
              Find every equilibrium.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Enter a payoff matrix, pick an algorithm, and watch it work. Two solvers written from scratch, with the pivots and the pruned supports
              laid open, and every speed claim backed by a measured number.
            </p>
          </div>
        </section>

        <SolverApp />

        <section id="benchmarks" className="border-b border-rule">
          <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
            <div className="flex items-baseline gap-4">
              <span className="num text-sm text-signal-ink">05</span>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Measured</h2>
            </div>
            <p className="mt-4 mb-10 max-w-2xl text-muted-foreground">
              Every optimization was benchmarked against the step before it, on seeded games. The log scale matters: each gridline is ten times
              slower than the one below.
            </p>
            <BenchmarkSection />
          </div>
        </section>

        <section id="method" className="border-b border-rule">
          <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-8">
            <div className="flex items-baseline gap-4">
              <span className="num text-sm text-signal-ink">06</span>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Method</h2>
            </div>
            <ol className="mt-10 grid gap-px border border-rule bg-rule md:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s) => (
                <li key={s.tag} className="bg-background p-6">
                  <p className="num text-5xl leading-none font-semibold tracking-tight text-signal-ink">{s.tag}</p>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="label mb-3 text-foreground">Correctness</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Every equilibrium either solver returns is re-checked by an independent best-response test. The test suite compares all six support
                  enumeration versions on 125 random games, confirms Lemke-Howson results are a subset of the full set, and asserts the count is odd, a
                  property every generic game must satisfy.
                </p>
              </div>
              <div>
                <h3 className="label mb-3 text-foreground">Limits</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Support enumeration is exponential in game size and assumes nondegenerate games. Lemke-Howson handles degeneracy but returns one
                  equilibrium per path, and some equilibria are unreachable from any label. Matrices are capped at 8×8.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8">
        <p className="label">Nash Solver · numpy · FastAPI · Next.js</p>
      </footer>
    </div>
  );
}
