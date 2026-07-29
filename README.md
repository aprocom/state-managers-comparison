# State Managers Comparison

Five React state managers, one non-trivial application, measured instead of argued about.

**RxJS · Redux Toolkit · MobX · Zustand · Jotai**

The same app is built five times. Everything except the state layer is shared — domain types, all P&L and statistics math, every presentational component. The implementations differ *only* in how state is stored, derived and propagated. That constraint is what makes the numbers comparable: a difference in lines of code or render time cannot come from anything else.

## Why these five

They span distinct paradigms rather than being five variations on one idea.

| | Paradigm | What it is under test for |
|---|---|---|
| **RxJS** | Streams | High-frequency updates, backpressure, temporal operators |
| **Redux Toolkit** | Centralised flux | Normalisation, listener middleware, boilerplate vs. predictability |
| **MobX** | Transparent reactivity | Fine-grained invalidation, `reaction`, "magic" as a maintenance risk |
| **Zustand** | Minimal hook store | Manual selectors, the price of minimalism at scale |
| **Jotai** | Bottom-up atoms | Granularity, composing derived atoms, `atomEffect` |

Deliberately excluded: Recoil (archived), XState (models logic rather than storing state — a different class of tool), Effector (strong library, narrow hiring geography).

## The reference application

**TraderCat Lite** — a trading terminal and journal. Two screens that stress state in opposite ways:

**Terminal** — a stream of 10/50/100 quote updates per second across 50 instruments. Open positions whose unrealised P&L is recomputed on every tick. This is where update frequency and render granularity show up.

**Journal** — 250 closed trades with filters and heavy aggregates: equity curve, win rate, R-multiple, profit factor, max drawdown, time in trade. This is where normalised entities and derived computation show up.

**The alert engine** is the heart of the comparison. Four rules borrowed from the real product — daily loss limit, risk per trade, tilt (a losing streak inside a time window), and time in trade — that read across several slices of state at once, depend on time, and must fire exactly once per transition into the triggered state. Every library solves this differently, and the difference is legible in the code without interpretation.

No backend, no network, no auth. The quote feed is a seeded generator and the trade history is a seeded fixture, so every run reproduces exactly.

## What gets measured

**Speed** — tick-to-paint latency (p50/p95), re-renders per tick, long tasks, heap after a 60-second soak, per-app bundle size. Collected via Playwright and the Performance API, three runs, median reported.

**Complexity** — lines of code in the state layer only, cyclomatic complexity, and the number of distinct library exports a newcomer has to learn.

**Maintenance cost** — measured by experiment rather than opinion. Once all five implementations are frozen at a tag, the same new feature is added to each one and the diff size, files touched, and amount of working code that had to change are recorded.

## First results

All five implementations pass the same 40 functional parity tests unchanged, so these numbers describe apps that genuinely do the same thing.

| | Bundle (gzip) | State-layer LOC | Files | Row identity preserved by |
|---|---:|---:|---:|---|
| **Jotai** | 68.8 kB | 183 | 2 | the atom graph |
| **MobX** | 82.4 kB | 229 | 1 | per-instrument computeds |
| **Redux Toolkit** | 73.9 kB | 264 | 3 | a hand-written cache |
| **Zustand** | 64.8 kB | 275 | 3 | a hand-written cache |
| **RxJS** | 71.6 kB | 304 | 2 | `scan`, incrementally |

Bundle size and the amount of code needed pull in opposite directions. Zustand ships the smallest bundle and needs the most code around it; MobX ships the largest and needs the least. Neither is a verdict — they are different budgets.

The sharpest single finding so far concerns **firing an alert exactly once per transition**:

- **MobX** — a `reaction` over a computed. The dependency graph decides when to run.
- **RxJS** — a `scan` that carries the previous key set. The diff is an operator, not bookkeeping.
- **Zustand, Jotai, Redux** — all three need a hand-maintained `Set` of already-fired keys. The derivation is cheap in Jotai and Redux; it is the *notification* that none of them model.

And on keeping row identity stable so one tick re-renders one row instead of fifty: MobX and Jotai get it from their dependency graphs, RxJS gets it from incremental `scan`, while Zustand and Redux both need an explicit per-row cache written by hand. In Zustand's case that is compounded by `useSyncExternalStore` demanding a stable reference from every selector, which is why its state layer is the second largest despite the smallest bundle.

## Status

- [x] **Foundation** — monorepo, shared domain package, shared component library, parity suite
- [x] **All five implementations** — 121 unit tests, 40 parity tests, `tsc --strict` clean
- [ ] **Runtime benchmarks** — tick-to-paint latency, re-render counts, long tasks, memory
- [ ] **Change-cost experiment, CI, live demo**

Runtime performance numbers are not published yet, and nothing above is one. Bundle size and LOC are measured from the build and the source; latency and re-render counts need the harness that comes next, and they will be generated from its JSON output rather than typed in by hand.

## Design and plans

- [Design spec](docs/superpowers/specs/2026-07-29-state-managers-comparison-design.md)
- [Plan 1 — foundation and reference implementation](docs/superpowers/plans/2026-07-29-foundation-and-reference-implementation.md)

## Running it

Requires Node 22+.

```bash
npm install
```

```bash
npm run dev -w @smc/app-zustand
```

```bash
npm test
```

```bash
npm run test:e2e
```

The parity suite is the acceptance gate: every implementation must pass the same eight functional tests, driven through a shared set of `data-testid` values, before its performance is measured at all. Benchmarking apps that behave differently would be meaningless.

## Licence

MIT
