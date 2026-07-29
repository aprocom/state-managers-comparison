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

**Terminal** — a stream of 10/100/1000 quote updates per second across 50 instruments. Open positions whose unrealised P&L is recomputed on every tick. This is where update frequency and render granularity show up.

**Journal** — 250 closed trades with filters and heavy aggregates: equity curve, win rate, R-multiple, profit factor, max drawdown, time in trade. This is where normalised entities and derived computation show up.

**The alert engine** is the heart of the comparison. Four rules borrowed from the real product — daily loss limit, risk per trade, tilt (a losing streak inside a time window), and time in trade — that read across several slices of state at once, depend on time, and must fire exactly once per transition into the triggered state. Every library solves this differently, and the difference is legible in the code without interpretation.

No backend, no network, no auth. The quote feed is a seeded generator and the trade history is a seeded fixture, so every run reproduces exactly.

## What gets measured

**Speed** — row re-renders per quote, frame rate, and long tasks under load, plus per-app bundle size. Collected via Playwright and the Performance API, three runs per rate, median reported. Row renders are counted by instrumentation inside the *shared* components, so the count measures the state layer and nothing else.

**Complexity** — lines of code in the state layer only, and how many files it is spread across.

**Maintenance cost** — measured by experiment rather than opinion. Once all five implementations are frozen at a tag, the same new feature is added to each one and the diff size, files touched, and amount of working code that had to change are recorded.

## Results

All five implementations pass the same 40 functional parity tests unchanged, so the numbers below describe apps that genuinely do the same thing.

### Speed: there is no difference

Measured over 6-second soaks, three repeats, median reported, on Chromium.

| Updates/sec | Row renders per quote | FPS | Long-task ms | 
|---:|---:|---:|---:|
| 10 | 1.00 — all five | 60 — all five | 0 — all five |
| 100 | 1.00 — all five | 60 — all five | 0 — all five |
| 1000 | 1.00 — all five | 60 — all five | 0 — all five |

One row render per quote is the optimal result: exactly the row that changed is re-rendered and nothing else. At 1000 updates per second — well past what any real venue pushes to a browser — every implementation still hits it, holds 60 FPS, and never blocks the main thread for 50 ms.

**The honest conclusion is that on this workload the state manager is not the bottleneck, and choosing between these five on performance grounds is choosing on a non-difference.** JS heap came back identical for all five, but Chromium quantises `performance.memory` heavily, so that measurement is reported here as uninformative rather than as a tie.

### The finding that actually matters

The first version of this benchmark showed RxJS, MobX and Redux re-rendering all fifty rows on every batch while Zustand and Jotai re-rendered one. That difference was **entirely a bug in the benchmark's own app code**: three of the five screens passed an inline arrow function as the `onSelect` prop, which changes identity on every render and defeats `React.memo` on every row. Zustand and Jotai happened to pass a stable store action.

Nothing about the libraries caused it. A comparison published before that was caught would have been confidently, quantitatively wrong.

Two lessons, and they are the reusable ones:

1. **Prop identity discipline dominates any difference between these libraries.** One inline arrow cost 50× the render work — far more than any architectural choice between the five.
2. **A benchmark you have not tried to falsify is a rumour with numbers attached.** The methodology bug is preserved in the git history and in the commit that fixed it rather than quietly rewritten.

A second methodology bug found the same way: the feed rounded its per-batch quota up, so every configured rate below 20/s actually delivered 20/s and silently doubled every per-quote metric.

### Complexity and maintenance cost

This is where the five genuinely differ.

| | Bundle (gzip) | State-layer LOC | Files |
|---|---:|---:|---:|
| **Jotai** | 68.8 kB | 183 | 2 |
| **MobX** | 82.4 kB | 229 | 1 |
| **Redux Toolkit** | 73.9 kB | 264 | 3 |
| **Zustand** | 64.8 kB | 275 | 3 |
| **RxJS** | 71.6 kB | 304 | 2 |

Bundle size and code volume pull in opposite directions. Zustand ships the smallest bundle and needs the most code around it; MobX ships the largest and needs the least. Neither is a verdict — they are different budgets, and 18 kB gzip is not worth 90 lines of hand-written caching to most teams.

**Where the correctness burden falls** is the more useful axis, because it is what you pay every time someone new touches the code:

*Keeping row identity stable* — MobX gets it from per-instrument computeds and Jotai from the atom graph; RxJS gets it from incremental `scan`. Zustand and Redux both need an explicit per-row cache written and maintained by hand. In Zustand's case that is compounded by `useSyncExternalStore` demanding a stable reference from every selector, which is why its state layer is the second largest despite the smallest bundle.

*Firing an alert exactly once per transition* — MobX expresses it as a `reaction` over a computed and RxJS as a `scan` carrying the previous key set. Zustand, Jotai and Redux each need a hand-maintained `Set` of already-fired keys. Note the split: Jotai and Redux derive cheaply but do not model *notification*, so the bookkeeping reappears there.

Every one of those hand-written caches is a place a future contributor can silently break performance — exactly as this project's own benchmark broke it.

## Status

- [x] **Foundation** — monorepo, shared domain package, shared component library, parity suite
- [x] **All five implementations** — 130 unit tests, 40 parity tests, `tsc --strict` clean
- [x] **Runtime benchmarks** — render counts, FPS, long tasks, at 10/100/1000 updates per second
- [ ] **Change-cost experiment** — add one feature to all five, measure the diff
- [ ] **CI and live demo**

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

```bash
npm run bench
```

The parity suite is the acceptance gate: every implementation must pass the same eight functional tests, driven through a shared set of `data-testid` values, before its performance is measured at all. Benchmarking apps that behave differently would be meaningless.

## Licence

MIT
