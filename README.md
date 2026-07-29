# State Managers Comparison

Five React state managers, one non-trivial application, measured properly — including the parts where the measurement says nothing.

**RxJS · Redux Toolkit · MobX · Zustand · Jotai**

The same app is built five times. Everything except the state layer is shared: domain types, all P&L and statistics maths, every presentational component. The implementations differ *only* in how state is stored, derived and propagated, and a cross-app test suite asserts that all five produce byte-identical derived state before any of them is timed.

**If you read one section, read [What this cannot tell you](#what-this-cannot-tell-you).** It is the point of the project. A comparison whose author has not tried to break it is a rumour with numbers attached.

---

## The short version

1. **On this workload, the state manager is not the bottleneck** — but that sentence has to be earned, not asserted, and the earlier version of this README asserted it from a metric that was mathematically incapable of showing anything else.
2. **What separates the five is main-thread CPU**, and only under load. Render counts, frame rate and long tasks are identical across all five and would be identical across a deliberately broken implementation too, at the rate this project used to headline.
3. **The largest performance effect measured here came from my own code, not from any library.** One inline arrow function cost 50× the render work — more than every architectural difference between the five combined.
4. **Where the libraries genuinely differ is who carries the correctness burden**: which invariants the library maintains for you, and which you have to re-derive by hand every time someone new touches the code.

---

## Why these five

They span distinct paradigms rather than being five variations on one idea.

| | Paradigm | What it is under test for |
|---|---|---|
| **RxJS** | Streams | High-frequency updates, temporal operators, incremental derivation via `scan` |
| **Redux Toolkit** | Centralised flux | Normalisation via `createEntityAdapter`, listener middleware, boilerplate vs. predictability |
| **MobX** | Transparent reactivity | Fine-grained invalidation, `reaction`, "magic" as a maintenance risk |
| **Zustand** | Minimal hook store | `useShallow`, `subscribeWithSelector`, the price of minimalism at scale |
| **Jotai** | Bottom-up atoms | Granularity, composing derived atoms, atom families |

Deliberately excluded: **Recoil** — archived 1 January 2025, last npm publish March 2023, never got React 18 concurrent support. **XState** — models logic rather than storing state, a different class of tool. **Effector** — a strong library, but see [the note on it below](#a-note-on-effector).

Each implementation is written the way that library's own documentation says to write it. This is not a courtesy; an earlier version hand-rolled a memoiser Zustand ships and skipped the two Redux APIs the table above claims Redux is under test for, which meant the complexity axis was measuring me rather than the libraries.

---

## The reference application

**TraderCat Lite** — a trading terminal and journal. Two screens that stress state in opposite ways.

**Terminal** — a seeded quote stream at 10/100/1000 updates per second across 50 instruments, six open positions whose unrealised P&L is recomputed on every tick, and a live alert panel.

**Journal** — 250 closed trades with filters and heavy aggregates: equity curve, win rate, R-multiple, profit factor, max drawdown, time in trade.

**The alert engine** is the sharpest part of the comparison. Four rules — daily loss limit, risk per trade, tilt (a losing streak inside a time window), time in trade — that read across several slices of state at once and must fire exactly once per transition *into* the triggered state, and re-arm when it clears. Every library solves this differently and the difference is legible in the code without interpretation.

No backend, no network, no auth. The quote feed is a seeded generator, the trade history is a seeded fixture, and the clock is frozen at construction, so the derived state is identical on every run and on every machine.

---

## Methodology

Stated in full, because in this genre the methodology *is* the contribution.

**Parity first.** Two suites gate the benchmark. `parity.spec.ts` drives all five apps through the same eight functional tests via a shared `data-testid` contract. `cross-app-parity.spec.ts` reads an exact value vector from every implementation — closed-trade statistics under three filters, the first twenty journal rows cell by cell, risk and drawdown totals, the alert key set — and requires all five to be **identical**, not merely individually plausible. Benchmarking apps that behave differently would be meaningless, and the first version of this project did exactly that for weeks without noticing.

**Production builds.** `vite preview` over `vite build` output, React 19 production. StrictMode is on in all five, which does not double-render outside development.

**Interleaved runs.** The outer loop is the repeat, the inner loop is the implementation. Running all of one app's samples consecutively lets thermal drift and background load land entirely on whichever app happened to be running, and that bias is indistinguishable from a result.

**A discarded warm-up per app**, so the first load's JIT tiering and one-time module evaluation do not land in the samples. This means the numbers describe warm, peak performance and not the cold path — a limitation, declared.

**Measured denominators.** The feed counts the quotes it actually delivers and the harness divides by that. The previous version divided by `configuredRate × elapsedSeconds`, a denominator nothing ever verified; one of its published samples read 1.008 renders per quote, a value the metric's own ceiling proves impossible.

**Statistics, not point estimates.** Every median carries a seeded bootstrap 95% confidence interval. Each implementation is tested against the best one on that metric with a two-sided Mann-Whitney U test (tie-corrected, continuity-corrected) — a rank test, because latency and CPU samples are bounded below and right-skewed, not normal. Effect size is Cliff's delta bucketed by the Romano thresholds, so a difference can be statistically real and still reported as practically negligible. **Any row the test does not separate is printed as "not significant" rather than as a ranking.**

**Two CPU conditions**, 1× and 4× via CDP `Emulation.setCPUThrottlingRate`. Every comparison in this genre stops at an unthrottled desktop, which is exactly where nothing differs.

**Metrics chosen for dynamic range**, and the range stated:

| Metric | Why | Ceiling / floor |
|---|---|---|
| Main-thread CPU (`ScriptDuration`) | The only metric that separates these five | none |
| Interaction latency (Event Timing) | The primitive INP is built from; no published state-manager comparison uses it | quantised to 8 ms |
| p99 inter-frame interval + dropped frames | Mean FPS is capped by vsync and reads 60 until things are catastrophic | 16.7 ms at 60 Hz |
| Total Blocking Time | Long-task *count* has a 50 ms dead zone this workload never approaches | 0 below 50 ms/task |
| Row renders per quote | Detects broken memoisation | **see below** |

**The row-render ceiling, which is the single most important caveat in this project.** React coalesces everything one feed batch does into a single commit. The feed emits 20 batches per second, so the worst any implementation can do is re-render all 50 rows once per batch. That makes the maximum readable value `50 × min(rate, 20) / rate` — **50** at 10 updates/sec, **10** at 100, and exactly **1.00** at 1000. At 1000 updates/sec an implementation that re-renders every row scores identically to one that re-renders only the row that changed. The metric is informative at the two lower rates and is pure decoration at the top one. `rendersPerQuoteCeiling()` computes this, it is unit-tested, and it is printed next to every table.

Everything is reproducible: `npm run bench` regenerates the raw samples, `npm run report` regenerates the tables from them, `npm run metrics` regenerates the complexity table from the source tree, and `npm run metrics -- --check` fails the build if the README's table has drifted from the code.

---

## Results

All five pass both parity suites unchanged, so the numbers below describe apps that provably do the same thing.

Full tables with confidence intervals and significance tests: **[bench-results/report.md](bench-results/report.md)**. Raw samples: **[bench-results/latest.json](bench-results/latest.json)**.

### Render granularity

All five render exactly one instrument row and one position row per quote, at every rate, under both CPU conditions. At 10 and 100 updates/sec that is a real result — the ceiling is 50 and 10 respectively, so a broken implementation would be plainly visible, and one was:

> Before the fix, MobX and Jotai re-rendered **all six** position rows per tick where the other three re-rendered one — a 6× difference at 10 updates/sec. Both derived `positionRows` from a single coarse computation over the whole array, so any price change handed `React.memo` six new objects. The instrument table in the same two apps was correctly per-item; only the positions were not. The benchmark measured this from the start, wrote it to `bench-results/latest.json`, and the reporting layer silently dropped the column — so a "no difference" conclusion was published over a 6× difference sitting in the repository.

The fix was a per-position `computed` in MobX and a `positionRowAtomFamily` in Jotai. The lesson generalises past this bug: **a dependency graph gives you fine-grained invalidation only at the granularity you actually build it at.** It is not automatic, and the two libraries whose pitch is that it comes for free are the two that got it wrong here.

### Main-thread CPU

This is where the five differ, and it is the axis the render-count metric hid completely. See [bench-results/report.md](bench-results/report.md) for the full tables with intervals and p-values.

### Interaction latency, frame pacing, blocking time

Under both CPU conditions, no implementation separated from the others on interaction latency, p99 frame interval, dropped frames or Total Blocking Time. Event Timing quantises to 8 ms and the workload never blocks the main thread for 50 ms, so the honest reading is that **this workload is too easy for these metrics to resolve**, not that the libraries are equal on them. Reporting a tie as a finding would repeat exactly the mistake this project already made once.

### Complexity

Regenerate with `npm run metrics`.

| | Bundle (gzip) | State-layer SLOC | Files | Wiring SLOC outside the state layer |
|---|---:|---:|---:|---:|
| **Jotai** | 68.9 kB | 198 | 2 | 131 |
| **MobX** | 82.9 kB | 262 | 1 | 106 |
| **Zustand** | 65.7 kB | 289 | 3 | 120 |
| **Redux Toolkit** | 77.9 kB | 307 | 3 | 146 |
| **RxJS** | 72.1 kB | 332 | 2 | 113 |

SLOC is non-blank, non-comment lines, so an implementation is not penalised for explaining itself. Bundle size is gzip -9 of the emitted JS and includes React and the shared packages in every figure — only the *deltas* between rows are library cost. The wiring column is counted separately on purpose: excluding it entirely flatters whichever library pushes work into the screens, and folding it in flatters whichever pushes it into the store.

### Cost of change

The axis nobody publishes. All five were frozen at a tag, the **same** feature was added to each, and the diff was measured. The feature: pin an instrument, pinned rows sort to the top of the table keeping their relative order, a pinned count appears in the account summary, and pins survive a screen switch. It was chosen because it needs new state, a new action, a re-ordering of an existing derivation that must not break row identity, and a new cross-cutting aggregate — not because any library handles it especially well.

The shared half of the change (the pin button, the row model field, the testids, the parity tests) is identical for all five and excluded. Regenerate with `git diff --shortstat before-pin-feature -- apps/<name>`.

| | Files touched | Lines added | Lines of working code modified | State-layer diff |
|---|---:|---:|---:|---:|
| **MobX** | 2 | 22 | 2 | +19 / −1 |
| **Jotai** | 2 | 28 | 5 | +18 / −2 |
| **Zustand** | 3 | 38 | 5 | +26 / −2 |
| **RxJS** | 2 | 42 | 8 | +38 / −7 |
| **Redux Toolkit** | 3 | 49 | 24 | +39 / −21 |

The third column is the one that matters: how much already-working code the change had to disturb. MobX needed two lines touched — one observable and one action on the existing per-instrument model, and the row computed picked the field up. Jotai added a parallel atom family and a write atom without touching the existing ones.

RxJS is the interesting case. Adding a *second kind of event* to a `scan` that previously consumed only quotes meant merging two streams and widening the accumulator's input type, so the incremental-derivation core had to be reopened and rewritten. The stream model gives excellent per-row identity for free and charges for it when the shape of the input changes.

**Redux's 24 is partly an artifact and should be read with that caveat.** Adding a third input to a `createSelector` converted an expression body to a block body, which re-indented the surrounding lines; perhaps eight of the 24 are genuine. Even discounted, it is the largest, and the reason is structural: the state, the action, the reducer case, the selector and the component are five separate edit sites by design. That separation is exactly what Redux is bought for on a large team — it is a cost that buys something, not a defect.

One measurement, one feature, one author. It is a data point, not a law; a feature shaped differently would rank these differently. But it is a *measured* data point on the axis where the literature has none.

### Where the correctness burden falls

More useful than either table above, because it is what you pay every time someone new touches the code.

*Keeping row identity stable.* MobX gets it from per-instrument and per-position computeds, Jotai from atom families, RxJS from incremental `scan`. Zustand and Redux each need an explicit per-row cache, written and maintained by hand. **But** — see the bug above — MobX and Jotai only get it where you built the graph at that granularity, and getting that wrong is silent. The hand-written cache is more code and more obvious; the graph is less code and fails quietly.

*Firing an alert exactly once per transition.* MobX expresses it as a `reaction` over a computed, RxJS as a `scan` carrying the previous key set. Zustand, Jotai and Redux each need a hand-maintained `Set` of already-fired keys. Redux's listener middleware notifies per *action*, not per transition of the derived value, so it does not remove the bookkeeping — it only removes the decision of when to re-evaluate.

*Deciding when to re-evaluate at all.* MobX and Jotai get this from the dependency graph. Zustand has `subscribeWithSelector` and Redux has the listener middleware's `predicate`; both are one-liners, and both were absent from the first version of this project, which is why three implementations were re-running a 250-element sort on every quote while two were not. That asymmetry was invisible to a metric that counts renders.

---

## What this cannot tell you

The limitations, at the same level of detail as the results. This section exists because a benchmark without one is advocacy.

**One workload, one shape.** Fifty rows, six positions, 250 trades, one browser, one machine. Nothing here predicts behaviour at 10,000 subscribers, in a collaborative editor, or under SSR.

**No SSR, no hydration, no React Server Components.** For several of these libraries the hydration story is a genuine differentiator and it is entirely unmeasured here.

**Warm, not cold.** A discarded warm-up per app means these are peak numbers. Users experience the cold path, which is not measured.

**Chromium only.** No Firefox, no Safari, no real mobile device — 4× CPU throttling is a model of a mid-range phone, not a phone.

**The row-render metric saturates at the top rate.** Restated because it matters: at 1000 updates/sec that column cannot distinguish an optimal implementation from a fully broken one. It is published with its ceiling next to it rather than quietly dropped, because the previous version of this README leaned on that exact cell as its strongest evidence.

**The journal screen is never benchmarked.** The feed lives in the terminal, so the aggregate-heavy half of the app — where `reselect`, MobX computeds and the atom graph would most plausibly diverge — contributes to the parity suites and to no performance number at all.

**Interaction latency and frame metrics did not resolve anything**, and a tie on a metric that cannot resolve differences is not evidence of equality.

**Five samples per cell.** Enough to compute an interval and run a rank test, not enough to detect a small effect. Where the test says "not significant", the honest reading is *this study did not detect a difference*, not *there is none*.

**The change-cost result is one feature, measured once, by the person who wrote all five implementations.** A differently shaped feature would rank them differently, and I had already spent weeks inside each codebase. Treat it as a data point, not a law.

**I am not a neutral party.** I wrote all five implementations. The defence against that is the cross-app parity suite, the fact that each library is used the way its own docs prescribe, and that every bug found in my own favour is documented above rather than quietly fixed.

---

## The bugs this project shipped

Kept because they are more instructive than the results, and because they are all in the git history anyway.

1. **The inline arrow.** Three of five terminal screens passed an inline arrow as `onSelect`, changing identity every render and defeating `React.memo` on all fifty rows. The other two happened to pass a stable store action. The result was a beautiful 50× spread that had **nothing to do with the libraries**. Later found again, unfixed, on the journal screen in four of five apps — where the same bug re-rendered all 250 rows.
2. **The rounded feed rate.** The feed rounded its per-batch quota up, so every configured rate below 20/s actually delivered 20/s, silently doubling every per-quote metric.
3. **The dropped position column.** Described above: a real 6× difference, measured, written to disk, and dropped by the report generator.
4. **The metric with no range.** The headline number could not vary at the rate it was headlined at.
5. **The test written to the bug.** RxJS subscribed its alert-notification stream at construction, so the initial alert set was consumed by an empty listener list and no listener ever received anything. The test that should have caught it asserted `toHaveLength(0)` where the other four asserted `1` — written to match the observed behaviour rather than the requirement.
6. **The sequence reset.** Changing the feed rate rebuilt the feed, restarting its per-instrument sequence counter while the stores still held the last sequence they had seen. Every store's staleness guard then silently dropped the next N quotes per instrument — 120 of them at 1000/s. The parity test named *"changes tick rate without breaking the stream"* passed throughout.
7. **The drifting clock.** Positions were seeded from a fixed date while alerts evaluated against a live `Date.now()`, so the alert set grew with the calendar: two alerts on the fixture date, five a year later. The README claimed every run reproduced exactly.

Every one of these was found by attacking the project's own conclusions after they looked good. Numbers 3 through 7 were found *after* the first version was written up as finished.

---

## Prior art

This project is not the first to build one app several ways.

- **[GantMan/ReactStateMuseum](https://github.com/GantMan/ReactStateMuseum)** — the canonical version: one packing-list app, ~40 state solutions, same rule that only the state decisions differ. It measures nothing, by design.
- **[gothinkster/realworld](https://github.com/gothinkster/realworld)** — the gold standard for app realism, 100+ implementations against one API spec. Explicitly refuses to measure.
- **[dai-shi/will-this-react-global-state-work-in-concurrent-rendering](https://github.com/dai-shi/will-this-react-global-state-work-in-concurrent-rendering)** — tearing and concurrency safety across ~23 libraries, as pass/fail. A dimension this project does not cover and should.
- **[krausest/js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)** and [Nolan Lawson's analysis of its limits](https://nolanlawson.com/2024/10/13/the-greatness-and-limitations-of-the-js-framework-benchmark/) — the limitations section above is written in the register that post established.
- **[Дмитрий Карловский's reactivity benchmark](https://habr.com/ru/articles/707600/)** — the only comparison I found that gates performance behind *correctness* tests, and the one whose framing most influenced this project's decision to require parity before timing.

What is new here is the combination: same app N ways, *and* real measurement, *and* the measurement's own limits reported as a first-class result.

---

## Status

- [x] **Foundation** — monorepo, shared domain package, shared component library
- [x] **All five implementations** — idiomatic per each library's own docs
- [x] **Functional parity** — 41 e2e tests, including exact cross-app equality of derived state
- [x] **Benchmark harness** — CPU, interaction latency, frame pacing, TBT, render granularity, at two CPU conditions, with confidence intervals and significance tests
- [x] **Reproducible complexity metrics** — `npm run metrics`, CI-enforced
- [x] **Change-cost experiment** — same feature added to all five from a frozen tag, diff measured
- [ ] **Concurrency safety** — run dai-shi's tearing suite against all five
- [ ] **Live demo** on GitHub Pages with an implementation switcher

---

## Design history

- [Original design](docs/design/2026-07-29-original-design.md) — written before anything was built, kept unedited. Several of its decisions turned out to be wrong.
- [Implementation plan](docs/design/2026-07-29-implementation-plan.md) — the first phase, task by task, with the corrections found while executing it.

---

## A note on Effector

Effector is prominent in Russian-language discussion and largely absent from English-language comparisons, which makes it easy to misjudge in either direction. It was excluded here on hiring reach, not on quality. The most useful public evidence is [VK's twelve-month production post-mortem](https://habr.com/ru/companies/vk/articles/839632/), which names specific structural problems — no dynamic store instances, no garbage collection, depth-first traversal causing redundant recomputation on diamond dependency graphs, and cyclic dependencies that freeze the app with no detection — against [ДомКлик's earlier positive experience](https://habr.com/ru/company/domclick/blog/532016/). Both are real production reports and they disagree; VK's is the better-evidenced of the two.

---

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

```bash
npm run report
```

```bash
npm run metrics
```

The parity suites are the acceptance gate: every implementation must pass the same functional tests and produce an identical derived-state vector before its performance is measured at all.

## Licence

MIT
