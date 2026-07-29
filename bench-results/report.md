# Benchmark results

Generated from `bench-results/latest.json`: 10 repeats per cell, 5-second soaks, 60 samples per implementation (10 per cell), runs interleaved across implementations, rates and CPU conditions.

Commit `a84ad60` · Apple M4 (10 threads) · 24 GB · darwin arm64 · node v22.15.0

## How to read these tables

Each median carries a seeded bootstrap 95% confidence interval.

Each implementation is compared against the best one on that metric with a two-sided Mann-Whitney U test — exact where the samples are untied, which they usually are, and the normal approximation with a tie correction otherwise.

**The p-values are Holm-adjusted across all 360 pairwise comparisons these samples admit** — every pair in every cell, not only the ones printed. Running this many tests at α = 0.05 and printing the raw values would be expected to produce several false positives and present them as findings. Holm controls the family-wise error rate without assuming the tests are independent, which they are not: the same samples appear in more than one comparison. 16 of 360 comparisons survive the correction.

The wider family is deliberate. The reference row in each table is whichever implementation came out best *in these same samples*, so the comparisons shown are the survivors of a selection — under a global null the winner is picked by noise and the gap to it is the largest gap available. Correcting only over the printed comparisons would ignore that selection. Correcting over all pairs covers every comparison the selection could have produced, which is conservative in the right direction.

The effect column is Cliff's delta bucketed by the Romano thresholds. A row marked **not significant** did not survive; it should not be read as a ranking, and it is not evidence of equality either — with this many samples per cell, only a large difference can be detected at all.

## CPU throttling 1×

An unthrottled desktop — where almost every published comparison stops.

### 10 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 9.5 [8.5–9.8] | — | best |
| **mobx** | 10.0 [9.3–10.1] | 1.0000 | not significant |
| **jotai** | 11.0 [10.8–11.2] | 0.2488 | not significant |
| **zustand** | 11.1 [9.9–11.3] | 1.0000 | not significant |
| **redux** | 12.2 [11.9–12.3] | 0.2488 | not significant |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–24] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–24] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 18.5 [18.4–18.6] | — | best |
| **jotai** | 18.5 [18.5–18.6] | 1.0000 | not significant |
| **mobx** | 18.5 [18.5–18.6] | 1.0000 | not significant |
| **redux** | 18.5 [18.5–18.6] | 1.0000 | not significant |
| **zustand** | 18.6 [18.5–18.6] | 1.0000 | not significant |

**Total Blocking Time**

Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever reached 50 ms, not that the implementations are equal.

| | totalBlockingMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.0000 | not significant |
| **mobx** | 0 [0–0] | 1.0000 | not significant |
| **jotai** | 0 [0–0] | 1.0000 | not significant |
| **redux** | 0 [0–0] | 1.0000 | not significant |

**Instrument row renders per quote**

Optimal is 1.00. The metric's ceiling at this rate is 50.00, so a fully unmemoised implementation would be plainly visible.

| | rendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

**Position row renders per quote on a held instrument**

Denominator measured by the feed, not assumed. This is the metric that caught MobX and Jotai deriving all six rows from one coarse computation.

Optimal is 1.00. The metric's ceiling at this rate is 6.00, so a fully unmemoised implementation would be plainly visible.

| | positionRendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

### 100 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 18.3 [18.0–18.7] | — | best |
| **mobx** | 19.1 [18.5–19.5] | 1.0000 | not significant |
| **zustand** | 24.7 [24.1–25.2] | 0.3560 | not significant |
| **jotai** | 27.5 [25.4–29.8] | 0.0149 | large |
| **redux** | 28.2 [26.8–29.2] | 0.0039 | large |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–24] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–24] | 1.0000 | not significant |
| **jotai** | 16 [16–20] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **redux** | 18.5 [18.5–18.5] | — | best |
| **zustand** | 18.5 [18.5–18.6] | 1.0000 | not significant |
| **jotai** | 18.6 [18.5–18.6] | 1.0000 | not significant |
| **rxjs** | 18.6 [18.5–18.6] | 1.0000 | not significant |
| **mobx** | 18.6 [18.5–18.6] | 1.0000 | not significant |

**Total Blocking Time**

Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever reached 50 ms, not that the implementations are equal.

| | totalBlockingMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.0000 | not significant |
| **mobx** | 0 [0–0] | 1.0000 | not significant |
| **jotai** | 0 [0–0] | 1.0000 | not significant |
| **redux** | 0 [0–0] | 1.0000 | not significant |

**Instrument row renders per quote**

Optimal is 1.00. The metric's ceiling at this rate is 10.00, so a fully unmemoised implementation would be plainly visible.

| | rendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

**Position row renders per quote on a held instrument**

Denominator measured by the feed, not assumed. This is the metric that caught MobX and Jotai deriving all six rows from one coarse computation.

Optimal is 1.00. The metric's ceiling at this rate is 6.00, so a fully unmemoised implementation would be plainly visible.

| | positionRendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

### 1000 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **mobx** | 37.2 [35.6–37.7] | — | best |
| **rxjs** | 44.8 [42.9–46.3] | 0.0039 | large |
| **zustand** | 74.4 [73.3–76.9] | 0.0039 | large |
| **jotai** | 87.5 [85.3–89.7] | 0.0039 | large |
| **redux** | 89.2 [81.0–90.4] | 0.0039 | large |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–16] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 18.5 [18.1–18.6] | — | best |
| **mobx** | 18.5 [18.1–18.6] | 1.0000 | not significant |
| **jotai** | 18.5 [18.1–18.6] | 1.0000 | not significant |
| **rxjs** | 18.5 [18.1–18.6] | 1.0000 | not significant |
| **redux** | 18.5 [18.1–18.6] | 1.0000 | not significant |

**Total Blocking Time**

Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever reached 50 ms, not that the implementations are equal.

| | totalBlockingMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.0000 | not significant |
| **mobx** | 0 [0–0] | 1.0000 | not significant |
| **jotai** | 0 [0–0] | 1.0000 | not significant |
| **redux** | 0 [0–0] | 1.0000 | not significant |

**Instrument row renders per quote**

Optimal is 1.00. The metric's ceiling at this rate is 1.00 — which is also the optimum, so this metric distinguishes nothing here and is printed only to show that it cannot.

| | rendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

**Position row renders per quote on a held instrument**

Denominator measured by the feed, not assumed. This is the metric that caught MobX and Jotai deriving all six rows from one coarse computation.

Optimal is 1.00. The metric's ceiling at this rate is 1.00 — which is also the optimum, so this metric distinguishes nothing here and is printed only to show that it cannot.

| | positionRendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

## CPU throttling 4×

**These numbers are not trustworthy.** Scripting time under 4× throttling comes to 0.19× to 0.28× of the unthrottled figure (zustand 0.27×, rxjs 0.19×, mobx 0.22×, jotai 0.28×, redux 0.23×), and a value below 1 says the same work cost less wall-clock time when the CPU was made slower, which cannot happen. Something in the collection is wrong — the last time this appeared it was the harness loop order, not CDP. Read the ordering within this section only, and do not quote the levels.

### 10 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **mobx** | 2.1 [1.8–2.7] | — | best |
| **rxjs** | 2.2 [1.7–2.3] | 1.0000 | not significant |
| **jotai** | 2.5 [2.3–2.6] | 1.0000 | not significant |
| **zustand** | 2.8 [2.4–3.1] | 1.0000 | not significant |
| **redux** | 3.1 [2.6–3.2] | 1.0000 | not significant |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–16] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **jotai** | 18.6 [18.6–18.7] | — | best |
| **zustand** | 18.7 [18.6–18.7] | 1.0000 | not significant |
| **rxjs** | 18.7 [18.6–18.7] | 1.0000 | not significant |
| **mobx** | 18.7 [18.6–18.7] | 1.0000 | not significant |
| **redux** | 18.7 [18.6–18.7] | 1.0000 | not significant |

**Total Blocking Time**

Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever reached 50 ms, not that the implementations are equal.

| | totalBlockingMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.0000 | not significant |
| **mobx** | 0 [0–0] | 1.0000 | not significant |
| **jotai** | 0 [0–0] | 1.0000 | not significant |
| **redux** | 0 [0–0] | 1.0000 | not significant |

**Instrument row renders per quote**

Optimal is 1.00. The metric's ceiling at this rate is 50.00, so a fully unmemoised implementation would be plainly visible.

| | rendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

**Position row renders per quote on a held instrument**

Denominator measured by the feed, not assumed. This is the metric that caught MobX and Jotai deriving all six rows from one coarse computation.

Optimal is 1.00. The metric's ceiling at this rate is 6.00, so a fully unmemoised implementation would be plainly visible.

| | positionRendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

### 100 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 3.1 [2.8–5.1] | — | best |
| **mobx** | 4.0 [3.2–5.9] | 1.0000 | not significant |
| **redux** | 6.1 [5.8–7.3] | 1.0000 | not significant |
| **zustand** | 6.2 [5.8–7.6] | 1.0000 | not significant |
| **jotai** | 7.7 [7.4–8.5] | 0.5011 | not significant |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–16] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 18.6 [18.2–18.7] | — | best |
| **jotai** | 18.6 [18.2–18.7] | 1.0000 | not significant |
| **zustand** | 18.7 [18.6–18.7] | 1.0000 | not significant |
| **redux** | 18.7 [18.2–18.7] | 1.0000 | not significant |
| **mobx** | 18.7 [18.2–18.7] | 1.0000 | not significant |

**Total Blocking Time**

Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever reached 50 ms, not that the implementations are equal.

| | totalBlockingMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.0000 | not significant |
| **mobx** | 0 [0–0] | 1.0000 | not significant |
| **jotai** | 0 [0–0] | 1.0000 | not significant |
| **redux** | 0 [0–0] | 1.0000 | not significant |

**Instrument row renders per quote**

Optimal is 1.00. The metric's ceiling at this rate is 10.00, so a fully unmemoised implementation would be plainly visible.

| | rendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

**Position row renders per quote on a held instrument**

Denominator measured by the feed, not assumed. This is the metric that caught MobX and Jotai deriving all six rows from one coarse computation.

Optimal is 1.00. The metric's ceiling at this rate is 6.00, so a fully unmemoised implementation would be plainly visible.

| | positionRendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

### 1000 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **mobx** | 11.6 [11.0–21.5] | — | best |
| **rxjs** | 21.4 [20.8–29.5] | 1.0000 | not significant |
| **zustand** | 44.9 [44.5–56.3] | 0.0039 | large |
| **redux** | 60.8 [59.6–71.9] | 0.0039 | large |
| **jotai** | 63.9 [63.1–77.5] | 0.0039 | large |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–16] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **mobx** | 18.6 [18.1–18.7] | — | best |
| **redux** | 18.6 [18.2–18.7] | 1.0000 | not significant |
| **zustand** | 18.7 [18.2–18.7] | 1.0000 | not significant |
| **rxjs** | 18.7 [18.2–18.7] | 1.0000 | not significant |
| **jotai** | 18.7 [18.2–18.7] | 1.0000 | not significant |

**Total Blocking Time**

Milliseconds beyond the 50 ms long-task threshold. 0 means no task ever reached 50 ms, not that the implementations are equal.

| | totalBlockingMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.0000 | not significant |
| **mobx** | 0 [0–0] | 1.0000 | not significant |
| **jotai** | 0 [0–0] | 1.0000 | not significant |
| **redux** | 0 [0–0] | 1.0000 | not significant |

**Instrument row renders per quote**

Optimal is 1.00. The metric's ceiling at this rate is 1.00 — which is also the optimum, so this metric distinguishes nothing here and is printed only to show that it cannot.

| | rendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

**Position row renders per quote on a held instrument**

Denominator measured by the feed, not assumed. This is the metric that caught MobX and Jotai deriving all six rows from one coarse computation.

Optimal is 1.00. The metric's ceiling at this rate is 1.00 — which is also the optimum, so this metric distinguishes nothing here and is printed only to show that it cannot.

| | positionRendersPerQuote, median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.0000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.0000 | not significant |

