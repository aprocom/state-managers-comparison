# Benchmark results

Generated from `bench-results/latest.json`: 1 repeats per cell, 5-second soaks, 3 samples per implementation, runs interleaved across implementations.

Every median carries a seeded bootstrap 95% confidence interval. The p-value is a
two-sided Mann-Whitney U test against the best implementation on that metric, and
the effect column is Cliff's delta bucketed by the Romano thresholds. A row marked
**not significant** means the ordering above it did not survive the noise and should
not be read as a ranking.

## CPU throttling 1×

An unthrottled desktop — where almost every published comparison stops.

### 10 updates/sec

**Main-thread CPU** — ms of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **mobx** | 8.7 [8.7–8.7] | — | best |
| **rxjs** | 9.4 [9.4–9.4] | 1.000 | not significant |
| **jotai** | 10.3 [10.3–10.3] | 1.000 | not significant |
| **redux** | 12.5 [12.5–12.5] | 1.000 | not significant |
| **zustand** | 13.4 [13.4–13.4] | 1.000 | not significant |

**Interaction latency** — worst Event Timing duration for a click made while
the feed was running. This is the primitive INP is computed from.

| | interactionWorstMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.000 | not significant |
| **mobx** | 16 [16–16] | 1.000 | not significant |
| **jotai** | 16 [16–16] | 1.000 | not significant |
| **redux** | 16 [16–16] | 1.000 | not significant |

**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.

| | frameP99Ms (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 17.6 [17.6–17.6] | — | best |
| **mobx** | 17.6 [17.6–17.6] | 1.000 | not significant |
| **rxjs** | 17.6 [17.6–17.6] | 1.000 | not significant |
| **redux** | 17.6 [17.6–17.6] | 1.000 | not significant |
| **jotai** | 17.6 [17.6–17.6] | 1.000 | not significant |

**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this rate is 50.00, so a fully unmemoised implementation would be visible.

| | rendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Position row renders per quote that touched a held instrument** — the metric
that caught MobX and Jotai deriving all six rows from one coarse computation.

| | positionRendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Total Blocking Time** — ms beyond the 50 ms long-task threshold.

| | totalBlockingMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.000 | not significant |
| **mobx** | 0 [0–0] | 1.000 | not significant |
| **jotai** | 0 [0–0] | 1.000 | not significant |
| **redux** | 0 [0–0] | 1.000 | not significant |

### 100 updates/sec

**Main-thread CPU** — ms of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **mobx** | 16.8 [16.8–16.8] | — | best |
| **rxjs** | 20.9 [20.9–20.9] | 1.000 | not significant |
| **jotai** | 23.3 [23.3–23.3] | 1.000 | not significant |
| **zustand** | 24.4 [24.4–24.4] | 1.000 | not significant |
| **redux** | 29.4 [29.4–29.4] | 1.000 | not significant |

**Interaction latency** — worst Event Timing duration for a click made while
the feed was running. This is the primitive INP is computed from.

| | interactionWorstMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.000 | not significant |
| **mobx** | 16 [16–16] | 1.000 | not significant |
| **jotai** | 16 [16–16] | 1.000 | not significant |
| **redux** | 16 [16–16] | 1.000 | not significant |

**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.

| | frameP99Ms (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 17.6 [17.6–17.6] | — | best |
| **jotai** | 17.6 [17.6–17.6] | 1.000 | not significant |
| **redux** | 17.6 [17.6–17.6] | 1.000 | not significant |
| **rxjs** | 17.7 [17.7–17.7] | 1.000 | not significant |
| **mobx** | 17.7 [17.7–17.7] | 1.000 | not significant |

**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this rate is 10.00, so a fully unmemoised implementation would be visible.

| | rendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Position row renders per quote that touched a held instrument** — the metric
that caught MobX and Jotai deriving all six rows from one coarse computation.

| | positionRendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.07 [1.07–1.07] | 1.000 | not significant |
| **redux** | 1.07 [1.07–1.07] | 1.000 | not significant |

**Total Blocking Time** — ms beyond the 50 ms long-task threshold.

| | totalBlockingMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.000 | not significant |
| **mobx** | 0 [0–0] | 1.000 | not significant |
| **jotai** | 0 [0–0] | 1.000 | not significant |
| **redux** | 0 [0–0] | 1.000 | not significant |

### 1000 updates/sec

**Main-thread CPU** — ms of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **mobx** | 34.4 [34.4–34.4] | — | best |
| **rxjs** | 65.5 [65.5–65.5] | 1.000 | not significant |
| **jotai** | 79.8 [79.8–79.8] | 1.000 | not significant |
| **zustand** | 90.3 [90.3–90.3] | 1.000 | not significant |
| **redux** | 94.8 [94.8–94.8] | 1.000 | not significant |

**Interaction latency** — worst Event Timing duration for a click made while
the feed was running. This is the primitive INP is computed from.

| | interactionWorstMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.000 | not significant |
| **mobx** | 16 [16–16] | 1.000 | not significant |
| **jotai** | 16 [16–16] | 1.000 | not significant |
| **redux** | 16 [16–16] | 1.000 | not significant |

**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.

| | frameP99Ms (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **rxjs** | 17.6 [17.6–17.6] | — | best |
| **zustand** | 17.6 [17.6–17.6] | 1.000 | not significant |
| **mobx** | 17.7 [17.7–17.7] | 1.000 | not significant |
| **jotai** | 17.7 [17.7–17.7] | 1.000 | not significant |
| **redux** | 17.7 [17.7–17.7] | 1.000 | not significant |

**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this rate is 1.00, which is also the optimum, so this metric distinguishes nothing here.

| | rendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **jotai** | 0.99 [0.99–0.99] | — | best |
| **zustand** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Position row renders per quote that touched a held instrument** — the metric
that caught MobX and Jotai deriving all six rows from one coarse computation.

| | positionRendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **jotai** | 0.99 [0.99–0.99] | — | best |
| **zustand** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Total Blocking Time** — ms beyond the 50 ms long-task threshold.

| | totalBlockingMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.000 | not significant |
| **mobx** | 0 [0–0] | 1.000 | not significant |
| **jotai** | 0 [0–0] | 1.000 | not significant |
| **redux** | 0 [0–0] | 1.000 | not significant |

