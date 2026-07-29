# Benchmark results

Generated from `bench-results/latest.json`: 10 repeats per cell, 5-second soaks, 60 samples per implementation (10 per cell), runs interleaved across implementations, rates and CPU conditions.

Commit `5f4a143` · Apple M4 (10 threads) · 24 GB · darwin arm64 · node v22.15.0

## How to read these tables

Each median carries a seeded bootstrap 95% confidence interval.

Each implementation is compared against the best one on that metric with a two-sided Mann-Whitney U test — exact where the samples are untied, which they usually are, and the normal approximation with a tie correction otherwise.

**The p-values are Holm-adjusted across all 360 pairwise comparisons these samples admit** — every pair in every cell, not only the ones printed. Running this many tests at α = 0.05 and printing the raw values would be expected to produce several false positives and present them as findings. Holm controls the family-wise error rate without assuming the tests are independent, which they are not: the same samples appear in more than one comparison. 11 of 360 comparisons survive the correction.

The wider family is deliberate. The reference row in each table is whichever implementation came out best *in these same samples*, so the comparisons shown are the survivors of a selection — under a global null the winner is picked by noise and the gap to it is the largest gap available. Correcting only over the printed comparisons would ignore that selection. Correcting over all pairs covers every comparison the selection could have produced, which is conservative in the right direction.

The effect column is Cliff's delta bucketed by the Romano thresholds. A row marked **not significant** did not survive; it should not be read as a ranking, and it is not evidence of equality either — with this many samples per cell, only a large difference can be detected at all.

## CPU throttling 1×

An unthrottled desktop — where almost every published comparison stops.

### 10 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 7.6 [6.9–8.8] | — | best |
| **jotai** | 8.5 [7.9–11.7] | 1.0000 | not significant |
| **mobx** | 8.6 [7.3–9.9] | 1.0000 | not significant |
| **zustand** | 8.8 [8.4–10.2] | 1.0000 | not significant |
| **redux** | 9.7 [8.7–11.4] | 1.0000 | not significant |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–20] | — | best |
| **rxjs** | 16 [16–16] | 1.0000 | not significant |
| **mobx** | 16 [16–24] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 17.6 [17.6–18.5] | — | best |
| **rxjs** | 17.7 [17.6–18.6] | 1.0000 | not significant |
| **mobx** | 17.7 [17.6–18.5] | 1.0000 | not significant |
| **jotai** | 17.7 [17.6–18.5] | 1.0000 | not significant |
| **redux** | 17.7 [17.6–18.6] | 1.0000 | not significant |

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
| **rxjs** | 14.6 [12.9–15.5] | — | best |
| **mobx** | 16.3 [13.1–19.4] | 1.0000 | not significant |
| **zustand** | 17.9 [15.3–20.2] | 1.0000 | not significant |
| **jotai** | 21.4 [16.9–25.8] | 0.7229 | not significant |
| **redux** | 23.6 [18.0–26.8] | 0.1695 | not significant |

**Interaction latency**

Worst Event Timing duration for a click made while the feed was running — the primitive INP is computed from. Quantised to 8 ms by the spec.

| | interactionWorstMs (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–20] | 1.0000 | not significant |
| **mobx** | 16 [16–16] | 1.0000 | not significant |
| **jotai** | 16 [16–16] | 1.0000 | not significant |
| **redux** | 16 [16–16] | 1.0000 | not significant |

**Frame pacing**

p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz and is also the floor.

| | frameP99Ms (ms), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **redux** | 17.6 [17.6–17.6] | — | best |
| **mobx** | 17.6 [17.6–17.7] | 1.0000 | not significant |
| **jotai** | 17.6 [17.6–17.7] | 1.0000 | not significant |
| **zustand** | 17.7 [17.6–18.6] | 1.0000 | not significant |
| **rxjs** | 17.7 [17.6–18.1] | 1.0000 | not significant |

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
| **mobx** | 29.6 [21.0–35.7] | — | best |
| **rxjs** | 37.0 [25.3–40.6] | 1.0000 | not significant |
| **zustand** | 58.9 [39.8–66.3] | 0.0718 | not significant |
| **redux** | 72.3 [50.9–82.0] | 0.0039 | large |
| **jotai** | 79.4 [51.1–87.6] | 0.0039 | large |

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
| **mobx** | 17.6 [17.6–17.7] | — | best |
| **jotai** | 17.6 [17.6–17.7] | 1.0000 | not significant |
| **zustand** | 17.6 [17.6–17.7] | 1.0000 | not significant |
| **redux** | 17.7 [17.6–18.1] | 1.0000 | not significant |
| **rxjs** | 17.7 [17.6–17.7] | 1.0000 | not significant |

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

Nominally a mid-range phone. **Do not compare these magnitudes with the 1× section**, and note that the reason is a property of the tool rather than of the apps. Between the two levels the same quotes are delivered, the same rows render and the frame rate is the same, yet scripting time moves only 0.67×–0.99× while renderer thread time moves 10.06×–11.88×. Chromium emulates a slower CPU by making the renderer thread spin, and the spin sits outside every script and every task, so `ScriptDuration` never sees the CPU it was charged — `ThreadTime` does. Run `npm run probe:throttle` to watch it happen on a page doing fixed work. The ordering within this section is measured the same way for all five and is comparable; the levels are not.

### 10 updates/sec

**Main-thread CPU**

Milliseconds of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | p (Holm-adjusted) | effect |
|---|---:|---:|---|
| **rxjs** | 4.7 [3.3–6.0] | — | best |
| **mobx** | 5.4 [3.8–7.1] | 1.0000 | not significant |
| **jotai** | 7.2 [5.4–8.5] | 1.0000 | not significant |
| **zustand** | 7.9 [5.2–9.3] | 1.0000 | not significant |
| **redux** | 8.9 [6.5–10.5] | 1.0000 | not significant |

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
| **redux** | 17.7 [17.7–18.6] | — | best |
| **zustand** | 17.7 [17.7–18.7] | 1.0000 | not significant |
| **rxjs** | 17.7 [17.7–18.6] | 1.0000 | not significant |
| **jotai** | 17.7 [17.7–18.6] | 1.0000 | not significant |
| **mobx** | 17.7 [17.7–18.7] | 1.0000 | not significant |

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
| **rxjs** | 10.0 [6.1–14.0] | — | best |
| **mobx** | 11.3 [5.6–13.4] | 1.0000 | not significant |
| **zustand** | 17.7 [13.7–18.3] | 1.0000 | not significant |
| **redux** | 18.7 [9.5–22.3] | 1.0000 | not significant |
| **jotai** | 20.0 [14.9–20.9] | 0.7229 | not significant |

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
| **rxjs** | 17.7 [17.7–17.7] | — | best |
| **mobx** | 17.7 [17.7–17.7] | 1.0000 | not significant |
| **jotai** | 17.7 [17.7–17.7] | 1.0000 | not significant |
| **redux** | 17.7 [17.7–17.7] | 1.0000 | not significant |
| **zustand** | 17.7 [17.7–18.4] | 1.0000 | not significant |

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
| **mobx** | 20.1 [14.8–25.0] | — | best |
| **rxjs** | 31.9 [24.9–34.2] | 0.9877 | not significant |
| **zustand** | 59.7 [52.2–63.2] | 0.0039 | large |
| **redux** | 77.0 [63.6–82.1] | 0.0039 | large |
| **jotai** | 78.7 [70.3–85.8] | 0.0039 | large |

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
| **zustand** | 17.7 [17.7–17.7] | — | best |
| **rxjs** | 17.7 [17.7–17.7] | 1.0000 | not significant |
| **redux** | 17.7 [17.6–18.2] | 1.0000 | not significant |
| **mobx** | 17.7 [17.7–17.7] | 1.0000 | not significant |
| **jotai** | 17.7 [17.7–18.1] | 1.0000 | not significant |

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

