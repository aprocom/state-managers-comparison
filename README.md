# State Managers Comparison

Five React state managers, one non-trivial application, measured properly — including the parts where the measurement says nothing.

**RxJS · Redux Toolkit · MobX · Zustand · Jotai**

The same app is built five times. Everything except the state layer is shared: domain types, all P&L and statistics maths, every presentational component. The implementations differ *only* in how state is stored, derived and propagated, and a cross-app test suite asserts that all five produce an identical derived-state vector — cell by cell — before any of them is timed. That vector covers everything computed from the seeded fixture and deliberately excludes everything downstream of the live feed: no two page loads observe a 1000/s stream at the same instant, so comparing unrealised P&L across apps would be comparing timing. It is a real hole in the gate, and it is listed as one in [What this cannot tell you](#what-this-cannot-tell-you).

**If you read one section, read [What this cannot tell you](#what-this-cannot-tell-you).** It is the point of the project. A comparison whose author has not tried to break it is a rumour with numbers attached.

---

## The short version

1. **On this workload, the state manager is not the bottleneck** — but that sentence has to be earned, not asserted, and the earlier version of this README asserted it from a metric that was mathematically incapable of showing anything else.
2. **The only axis where anything separates is main-thread CPU, and even there only two of the five separate** — MobX and RxJS cost roughly half what Redux and Jotai do at 1000 updates/sec, on output the cross-app suite proves identical, but after correcting for every comparison the report makes, just 11 of 360 survive. Render counts, frame rate, interaction latency and blocking time separate nothing at any rate, and at the rate this project used to headline, the render-count metric could not have separated a deliberately broken implementation either.
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

**Parity first.** Two suites gate the benchmark. `parity.spec.ts` drives all five apps through the same ten functional tests via a shared `data-testid` contract. `cross-app-parity.spec.ts` reads an exact value vector from every implementation — closed-trade statistics under three filters, the first twenty journal rows cell by cell, risk and drawdown totals, the alert key set — and requires all five to be **identical**, not merely individually plausible. Benchmarking apps that behave differently would be meaningless, and the first version of this project did exactly that without noticing.

**Production builds.** `vite preview` over `vite build` output, React 19 production. StrictMode is on in all five, which does not double-render outside development.

**Interleaved runs.** The outer loop is the repeat, the inner loop is the implementation. Running all of one app's samples consecutively lets thermal drift and background load land entirely on whichever app happened to be running, and that bias is indistinguishable from a result.

**A discarded warm-up per app**, so the first load's JIT tiering and one-time module evaluation do not land in the samples. This means the numbers describe warm, peak performance and not the cold path — a limitation, declared.

**Measured denominators.** The feed counts the quotes it actually delivers and the harness divides by that. The previous version divided by `configuredRate × elapsedSeconds`, a denominator nothing ever verified; one of its published samples read 1.008 renders per quote, a value the metric's own ceiling proves impossible.

**Statistics, not point estimates.** Every median carries a seeded bootstrap 95% confidence interval. Each implementation is tested against the best one on that metric with a two-sided Mann-Whitney U test — a rank test, because CPU and latency samples are bounded below and right-skewed, not normal — computed **exactly** where the samples are untied. That matters: the normal approximation has a floor of 0.0122 at five samples per group, so an earlier version printed exactly 0.0122 for every significant result and a reader could not tell a decisive separation from a marginal one.

**p-values are Holm-adjusted across all 360 pairwise comparisons these samples admit** — every pair in every cell, not only the ones the tables print. Running that many tests at α = 0.05 and printing raw values would be expected to produce a double-figure count of false positives and present them as findings. The wider family is deliberate: the reference row in each table is whichever implementation came out best *in these same samples*, so what is printed has already survived a selection, and correcting only over the printed comparisons would ignore that the winner itself was chosen from the data. Correcting over all pairs covers every comparison the selection could have produced. Effect size is Cliff's delta bucketed by the Romano thresholds, so a difference can be statistically real and still be reported as practically negligible. Any row the test does not separate is printed as "not significant" — which is not evidence of equality, only of undetected difference.

**Two CPU conditions**, 1× and 4× via CDP `Emulation.setCPUThrottlingRate`. Every comparison in this genre stops at an unthrottled desktop, which is exactly where nothing differs.

**Metrics chosen for dynamic range**, and the range stated:

| Metric | Why | Ceiling / floor |
|---|---|---|
| Main-thread CPU (`ScriptDuration`) | The only metric that separates these five | none |
| Interaction latency (Event Timing) | The primitive INP is built from; no published state-manager comparison uses it | quantised to 8 ms |
| p99 inter-frame interval + dropped frames | Mean FPS is capped by vsync and reads 60 until things are catastrophic | 16.7 ms at 60 Hz |
| Total Blocking Time | Long-task *count* has a 50 ms dead zone this workload never approaches | 0 below 50 ms/task |
| Row renders per quote | Detects broken memoisation | **see below** |

**The row-render ceilings, which are the single most important caveat in this project.** React coalesces everything one feed batch does into a single commit. The feed emits 20 batches per second, so the worst any implementation can do is re-render all 50 rows once per batch. That makes the maximum readable value `50 × min(rate, 20) / rate` — **50** at 10 updates/sec, **10** at 100, and exactly **1.00** at 1000. At 1000 updates/sec an implementation that re-renders every row scores identically to one that re-renders only the row that changed. The metric is informative at the two lower rates and is pure decoration at the top one. `rendersPerQuoteCeiling()` computes this, it is unit-tested, and it is printed next to every table. The position table saturates the same way — six rows fed by the 6/50 of quotes that land on a held instrument gives a ceiling of 6.00 at the two lower rates and **1.00 at 1000**. That sibling ceiling went undisclosed for one round while this paragraph called the instrument one the most important caveat in the project; `positionRendersPerQuoteCeiling()` now computes it and the report prints it too.

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

The only axis on which anything separates at all, and the one the render-count metric hid completely.

Milliseconds of scripting per second of wall clock at 1000 updates/sec, unthrottled, median of 10 with a bootstrap 95% CI, p Holm-adjusted across all 360 pairwise comparisons these samples admit:

| | CPU ms/s | p | effect |
|---|---:|---:|---|
| **MobX** | 29.6 [21.0–35.7] | — | best |
| **RxJS** | 37.0 [25.3–40.6] | 1.0000 | not significant |
| **Zustand** | 58.9 [39.8–66.3] | 0.0718 | not significant |
| **Redux Toolkit** | 72.3 [50.9–82.0] | 0.0039 | large |
| **Jotai** | 79.4 [51.1–87.6] | 0.0039 | large |

**Two of the four gaps survive the correction. Read the table as that, not as a ranking of five.** The medians span 2.7×, but the intervals are wide and heavily overlapping, and only Redux and Jotai are separated from MobX by more than this study can attribute to noise. Zustand at p = 0.07 is the kind of result that becomes a finding only if you go looking for one. RxJS is not distinguishable from MobX here at all. Under 4× throttling Zustand separates as well and the rest holds; at 10 and 100 updates/sec **nothing separates from anything, on any metric**. Across the entire report, five printed comparisons survive the correction and all five are this metric at this rate — eleven survive out of the full 360-pair family, which includes pairs the tables do not print.

What did replicate across two independent 35-minute runs on this machine is the *grouping*: MobX and RxJS cheap, Zustand, Redux and Jotai expensive. What did not replicate is the order inside the expensive group — the previous run had Zustand 74.4, Jotai 87.5, Redux 89.2 and this one has Zustand 58.9, Redux 72.3, Jotai 79.4. Anyone quoting a first-to-fifth ordering from this project is quoting noise.

Full tables for every metric, rate and condition: **[bench-results/report.md](bench-results/report.md)**. The samples were produced by commit `5f4a143`, recorded in the results file, from a clean working tree; nothing under `apps/` or `packages/` has changed since.

**Read this table knowing that the previous version of it was wrong.** Before the last round of fixes, three implementations recomputed a 250-trade drawdown on every quote while two recomputed it on 12% of them, purely because of where that invariant sat in each derivation graph. Jotai in particular was near the *top* of the table for that reason and is now near the bottom. This is the second confident performance ranking this project produced that turned out to be measuring its own code, and a third should be assumed live until someone outside it has looked.

**What the five do per quote is still not the same, and that is the point of this column.** They render the same thing — one instrument row, one position row — but they arrive at it differently, and the difference is visible in the source:

| | per quote, before any row renders |
|---|---|
| **MobX** | one observable write; one `computed` row recomputed |
| **Jotai** | one atom write; one row atom recomputed |
| **RxJS** | one row rewritten incrementally by `scan`, but all six position rows re-mapped |
| **Zustand** | all 50 instrument rows re-derived, then identity-cached down to the one that moved |
| **Redux Toolkit** | the same 50, through a reselect selector, plus the action and reducer round trip |

The two coarse ones are not sloppy: a store-plus-selectors design derives from a snapshot, and mapping the collection is the idiomatic way to do it. Making them per-row would mean hand-writing a subscription per instrument, which is what the fine-grained libraries are *for*. So this table is a genuine architectural difference between the approaches rather than a handicap I imposed on two of them.

**It also does not explain the measurements, and the obvious story here is the wrong one.** If per-item invalidation were the thing that made a difference, MobX and Jotai would be the two cheap ones. MobX is the cheapest and Jotai is the most expensive — while RxJS, which re-maps all six position rows on every quote, comes second. So doing less work per quote is not what separates these five on this workload. Whatever Jotai spends its time on, at 50 atoms plus 50 derived row atoms plus six position atoms, costs more than Zustand spends mapping a 50-element array and throwing 49 of the results away. Fine-grained reactivity has per-unit bookkeeping, that bookkeeping scales with the number of units, and this benchmark cannot tell you where the crossover is — only that at this size the granularity argument does not predict the ranking. I am declining to invent a mechanism for it here; profiling the atom graph properly is a separate piece of work and is not something to guess at in a README.

**The 4× throttling anomaly had two causes, and neither of them was CDP being broken.** The symptom: that section reported *less* scripting time than the unthrottled one, for work the harness proves identical. I first published it as an unexplained anomaly, which is the least useful thing to do with one.

The first cause was mine. The throttle level sat outside the per-implementation loop, so all five 1× samples ran and then all five 4× samples a minute later, and any drift in machine state mapped systematically onto the condition — the same bias interleaving the implementations was introduced to remove, one level up. The step is visible in the old samples: every app's ratio jumps at the same repeat, in the same direction, at every rate, which no property of an app can explain. Fixing the loop moved the 4×/1× ratios from 0.2–0.3 to 0.74–1.18.

The second cause is what the residue was, and it took an experiment rather than an argument. **`ScriptDuration` does not measure the CPU that throttling charges you.** Chromium emulates a slower processor by making the renderer thread spin, and the spin sits outside every script and every task, so the script counter never sees it. [`scripts/throttle-probe.mjs`](scripts/throttle-probe.mjs) shows this on a page doing a fixed amount of arithmetic on a timer: at 4× the tick count and frame count are identical, `ScriptDuration` moves about 1.2×, and `ThreadTime` moves about 28× — from ~135 ms to ~3.8 s of a 5-second soak, which is 76% of the thread, exactly what stealing three quarters of a CPU looks like. Run it yourself:

```bash
npm run probe:throttle
```

The benchmark now records `threadMsPerSecond` alongside the script counter, so the same thing is checkable in this project's own samples: between the two levels scripting time moves 0.67×–0.99× while renderer thread time moves 10×–12×. So the ratio being near or below 1 was never physically impossible — it was a counter answering a question I wasn't asking. **The ordering within each throttle section is measured identically for all five and is comparable. The magnitudes between sections are not, and no amount of re-running will make them so.**

### Interaction latency, frame pacing, blocking time

Under both CPU conditions, no implementation separated from the others on interaction latency, p99 frame interval, dropped frames or Total Blocking Time. Event Timing quantises to 8 ms and the workload never blocks the main thread for 50 ms, so the honest reading is that **this workload is too easy for these metrics to resolve**, not that the libraries are equal on them. Reporting a tie as a finding would repeat exactly the mistake this project already made once.

### Complexity

Regenerate with `npm run metrics`.

| | Bundle (gzip) | State-layer SLOC | Files | Wiring SLOC outside the state layer |
|---|---:|---:|---:|---:|
| **Jotai** | 69.2 kB | 197 | 2 | 131 |
| **MobX** | 83.2 kB | 270 | 1 | 106 |
| **Zustand** | 65.9 kB | 302 | 3 | 124 |
| **Redux Toolkit** | 78.2 kB | 316 | 3 | 147 |
| **RxJS** | 72.6 kB | 350 | 2 | 118 |

SLOC is non-blank, non-comment lines, so an implementation is not penalised for explaining itself. Bundle size is gzip -9 of the emitted JS and includes React and the shared packages in every figure — only the *deltas* between rows are library cost. The wiring column is counted separately on purpose: excluding it entirely flatters whichever library pushes work into the screens, and folding it in flatters whichever pushes it into the store.

### Cost of change

The axis nobody publishes. All five were frozen at a tag, the **same** feature was added to each, and the diff was measured. The feature: pin an instrument, pinned rows sort to the top of the table keeping their relative order, a pinned count appears in the account summary, and pins survive a screen switch. It was chosen because it needs new state, a new action, a re-ordering of an existing derivation that must not break row identity, and a new cross-cutting aggregate — not because any library handles it especially well.

The shared half of the change (the pin button, the row model field, the testids, the parity tests) is identical for all five and excluded. Regenerate with `git diff --shortstat before-pin-feature after-pin-feature -- apps/<name>` — both tags, not tag-to-HEAD, or you measure everything that happened since as well.

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

*Keeping row identity stable.* MobX gets it from per-instrument and per-position computeds, Jotai from atom families. RxJS gets it from incremental `scan` **for the instrument table only** — position rows come from `combineLatest` and need the same hand-written per-row cache Zustand and Redux use, which is visible at `apps/rxjs/src/state/store.ts` and is the honest version of a claim this README previously overstated. And per the bug above, MobX and Jotai only get it where the graph was built at that granularity; getting that wrong is silent. The hand-written cache is more code and more obvious. The graph is less code and fails quietly.

*Firing an alert exactly once per transition.* **All five keep a set of already-fired keys.** That is worth stating plainly because this README used to claim otherwise. What differs is where the set lives and what maintains it: RxJS carries it through a `scan`, so it is part of the pipeline and cannot drift out of sync with the stream; the other four hold it in a closure that something has to remember to reset. MobX's `reaction` and Redux's listener middleware decide *when* to re-evaluate — real work, and a real difference — but neither removes the key set. A library that gave you fire-once-per-transition over a derived collection for free would be a genuine differentiator, and none of these five does.

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

**The cross-app gate never compares anything downstream of the live feed.** Prices, unrealised P&L and the account total move with a stream that no two page loads observe at the same instant, so the vector compares only what the seeded fixture determines. Everything the feed touches is checked per app against loose predicates instead — "the price changed", "P&L moved" — and that is precisely the weaker kind of assertion this project has already been burned by. A divergence that only shows up mid-stream would survive the gate; one did, and is item 11 below.

**No end-to-end test covers an alert *leaving* the panel.** The engines are unit-tested for it in all five, but the bug that actually shipped lived in the screen wiring, not the engine — and the seeded feed cannot produce a clearing transition to test against: its ±0.1% walk moves unrealised P&L by single-digit dollars against a $400 limit, so the only rule that responds to price never crosses its threshold. Closing this properly needs a deterministic way to drive the store from the browser, which the apps do not currently expose. It is an open gap, not a solved one.

**Ten samples per cell.** Enough for the exact test to reach p ≈ 10⁻⁵ and survive a 360-way Holm correction, not enough to detect a small effect. Where the test says "not significant", the honest reading is *this study did not detect a difference*, not *there is none*.

**The change-cost result is one feature, measured once, by the person who wrote all five implementations.** A differently shaped feature would rank them differently, and the author knew every codebase intimately before starting the clock. One measurement is a data point, not a law.

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
8. **The asymmetry that faked the headline result.** `maxDrawdown(equityCurve(trades))` — a copy, sort and scan over 250 trades — sat inside a derivation that a price change invalidates. In Zustand, Redux and RxJS that put it on the hot path a thousand times a second; MobX and Jotai read prices per held instrument, so they paid it on 12% of quotes. **A large part of the CPU gap this project was about to publish as a difference between libraries was a difference between my derivation graphs.** Compounding it: the `subscribeWithSelector` and listener-middleware guards meant to stop the alert engine re-evaluating compared the identity of the `prices` object, which is rebuilt on every quote, so they never once short-circuited — while the comment above each of them claimed they did.
9. **The alert panel that could never clear.** MobX and Jotai rendered the alert list from the `onFire` callback. `onFire` runs for newly triggered alerts only, so nothing fires on the way out and a cleared alert stayed on screen forever — in the feature the README calls the sharpest part of the comparison, and in the two implementations whose fine-grained reactivity is supposed to make exactly this easy.
10. **Four vacuous tests.** "Stops firing once detached" detached the engine, applied a quote that could not move any rule past its threshold, and asserted nothing fired. Replacing `detach()` with a no-op left all four passing. The alert engine's reactivity was untested in four of five implementations.

11. **The staleness guard that swallowed itself.** Jotai kept its per-instrument sequence number inside the same atom as the price, and skipped the write when a quote repeated the current price — correctly, since none of the five re-render for a quote that moves nothing. But skipping the write also skipped the sequence number, so an out-of-order quote that the other four reject as stale would be *accepted* here and would move the price backwards. Nothing catches it: the prices agree right up to the instant they stop agreeing, the seeded feed is strictly ordered so it cannot occur in this app, and the cross-app gate does not compare live prices at all. The fix splits the sequence into its own atom, and all five now carry the same test.

Numbers 1, 2 and 6 I found myself. **Numbers 3 through 5, 7 through 10 and 11 were found by adversarial review after the project had been written up as finished — three times.** That ratio is the honest headline of this section: attacking your own work catches some of it, and having something else attack it catches the rest.

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
- [x] **Functional parity** — 51 e2e tests, including exact cross-app equality of derived state
- [x] **Benchmark harness** — CPU, interaction latency, frame pacing, TBT, render granularity, at two CPU conditions, with bootstrap intervals, exact rank tests and a family-wise correction
- [x] **Reproducible complexity metrics** — `npm run metrics`, CI-enforced
- [x] **Change-cost experiment** — same feature added to all five from a frozen tag, diff measured
- [x] **The throttling anomaly, explained rather than declared** — the harness loop order was one cause; the other is that `ScriptDuration` cannot see the CPU that throttling charges, demonstrated by `npm run probe:throttle` and recorded per sample as `threadMsPerSecond`
- [ ] **Concurrency safety** — run dai-shi's tearing suite against all five
- [ ] **End-to-end coverage for an alert leaving the panel** — needs a deterministic way to drive the store from the browser
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

Current counts: **175 unit tests**, **51 e2e tests**, `tsc --strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` clean across nine projects.

## Licence

MIT
