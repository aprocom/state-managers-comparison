# Benchmark results

Generated from `bench-results/latest.json`: 5 repeats per cell, 5-second soaks, 30 samples per implementation, runs interleaved across implementations.

Every median carries a seeded bootstrap 95% confidence interval. The p-value is a
two-sided Mann-Whitney U test against the best implementation on that metric, and
the effect column is Cliff's delta bucketed by the Romano thresholds. A row marked
**not significant** means the ordering above it did not survive the noise and should
not be read as a ranking.

Commit `b79239f` · Apple M4 (10 threads) · 24 GB · darwin arm64 · node v22.15.0



## CPU throttling 1×

An unthrottled desktop — where almost every published comparison stops.

### 10 updates/sec

**Main-thread CPU** — ms of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **mobx** | 9.5 [7.8–10.3] | — | best |
| **rxjs** | 10.1 [8.5–10.1] | 1.000 | not significant |
| **jotai** | 10.1 [8.7–10.5] | 0.676 | not significant |
| **redux** | 11.1 [9.5–13.2] | 0.037 | large |
| **zustand** | 11.8 [10.4–12.9] | 0.012 | large |

**Interaction latency** — worst Event Timing duration for a click made while
the feed was running. This is the primitive INP is computed from.

| | interactionWorstMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.000 | not significant |
| **mobx** | 16 [16–24] | 0.177 | not significant |
| **jotai** | 16 [16–16] | 1.000 | not significant |
| **redux** | 16 [16–24] | 0.424 | not significant |

**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.

| | frameP99Ms (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **mobx** | 17.6 [17.6–18.6] | — | best |
| **zustand** | 17.7 [17.6–18.7] | 0.449 | not significant |
| **rxjs** | 17.7 [17.6–18.6] | 0.746 | not significant |
| **redux** | 17.7 [17.6–18.6] | 0.914 | not significant |
| **jotai** | 17.7 [17.7–18.6] | 0.599 | not significant |

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
| **mobx** | 16.3 [12.6–18.9] | — | best |
| **rxjs** | 20.4 [15.4–21.2] | 0.144 | not significant |
| **jotai** | 23.0 [18.0–26.9] | 0.037 | large |
| **zustand** | 23.1 [20.3–29.3] | 0.012 | large |
| **redux** | 29.6 [25.9–32.8] | 0.012 | large |

**Interaction latency** — worst Event Timing duration for a click made while
the feed was running. This is the primitive INP is computed from.

| | interactionWorstMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.000 | not significant |
| **mobx** | 16 [16–24] | 0.177 | not significant |
| **jotai** | 16 [16–24] | 0.424 | not significant |
| **redux** | 16 [16–16] | 1.000 | not significant |

**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.

| | frameP99Ms (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **redux** | 17.6 [17.6–18.6] | — | best |
| **zustand** | 17.6 [17.6–18.5] | 0.829 | not significant |
| **rxjs** | 17.7 [17.6–18.6] | 0.112 | not significant |
| **mobx** | 17.7 [17.5–18.6] | 0.527 | not significant |
| **jotai** | 17.7 [17.6–18.7] | 0.089 | not significant |

**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this rate is 10.00, so a fully unmemoised implementation would be visible.

| | rendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [0.99–1.01] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Position row renders per quote that touched a held instrument** — the metric
that caught MobX and Jotai deriving all six rows from one coarse computation.

| | positionRendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **rxjs** | 1.00 [1.00–1.00] | — | best |
| **jotai** | 1.00 [0.99–1.08] | 0.607 | not significant |
| **redux** | 1.00 [1.00–1.07] | 0.177 | not significant |
| **zustand** | 1.07 [1.00–1.07] | 0.020 | large |
| **mobx** | 1.07 [1.00–1.07] | 0.067 | not significant |

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
| **mobx** | 31.2 [24.5–37.6] | — | best |
| **rxjs** | 67.0 [56.7–72.5] | 0.012 | large |
| **jotai** | 75.1 [50.9–88.7] | 0.012 | large |
| **zustand** | 88.4 [78.4–94.5] | 0.012 | large |
| **redux** | 96.7 [61.3–107.2] | 0.012 | large |

**Interaction latency** — worst Event Timing duration for a click made while
the feed was running. This is the primitive INP is computed from.

| | interactionWorstMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 16 [16–16] | — | best |
| **rxjs** | 16 [16–16] | 1.000 | not significant |
| **mobx** | 16 [16–16] | 1.000 | not significant |
| **jotai** | 16 [16–24] | 0.424 | not significant |
| **redux** | 16 [16–16] | 1.000 | not significant |

**Frame pacing** — p99 of the inter-frame interval. 16.7 ms is a clean 60 Hz.

| | frameP99Ms (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 17.6 [17.6–18.6] | — | best |
| **jotai** | 17.6 [17.6–18.6] | 0.752 | not significant |
| **redux** | 17.6 [17.6–18.6] | 0.338 | not significant |
| **rxjs** | 17.7 [17.6–18.6] | 0.337 | not significant |
| **mobx** | 17.7 [17.6–18.6] | 0.669 | not significant |

**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this rate is 1.00, which is also the optimum, so this metric distinguishes nothing here.

| | rendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [1.00–1.01] | 0.424 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Position row renders per quote that touched a held instrument** — the metric
that caught MobX and Jotai deriving all six rows from one coarse computation.

| | positionRendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [1.00–1.01] | 0.424 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Total Blocking Time** — ms beyond the 50 ms long-task threshold.

| | totalBlockingMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.000 | not significant |
| **mobx** | 0 [0–0] | 1.000 | not significant |
| **jotai** | 0 [0–0] | 1.000 | not significant |
| **redux** | 0 [0–0] | 1.000 | not significant |

## CPU throttling 4×

Approximately a mid-range phone.

### 10 updates/sec

**Main-thread CPU** — ms of scripting per second of wall clock.

| | scriptMsPerSecond (ms/s), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **mobx** | 3.8 [3.2–6.9] | — | best |
| **rxjs** | 4.0 [3.4–7.3] | 0.296 | not significant |
| **jotai** | 5.7 [3.7–8.3] | 0.403 | not significant |
| **redux** | 6.5 [5.1–10.2] | 0.095 | not significant |
| **zustand** | 7.1 [5.8–9.9] | 0.037 | large |

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
| **zustand** | 17.7 [17.6–18.7] | — | best |
| **mobx** | 17.7 [17.6–18.7] | 0.670 | not significant |
| **rxjs** | 17.7 [17.7–18.6] | 0.398 | not significant |
| **jotai** | 17.7 [17.6–18.7] | 0.595 | not significant |
| **redux** | 17.7 [17.7–18.7] | 0.114 | not significant |

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
| **mobx** | 5.9 [4.2–17.0] | — | best |
| **rxjs** | 8.6 [6.8–20.1] | 0.210 | not significant |
| **jotai** | 13.8 [11.1–22.4] | 0.144 | not significant |
| **redux** | 14.8 [13.6–24.0] | 0.095 | not significant |
| **zustand** | 15.2 [12.0–22.5] | 0.144 | not significant |

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
| **zustand** | 17.7 [17.6–18.7] | — | best |
| **jotai** | 17.7 [17.6–18.7] | 0.515 | not significant |
| **redux** | 17.7 [17.6–18.6] | 0.914 | not significant |
| **rxjs** | 17.7 [17.7–18.7] | 0.290 | not significant |
| **mobx** | 17.7 [17.7–18.6] | 0.589 | not significant |

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
| **zustand** | 1.00 [1.00–1.07] | — | best |
| **rxjs** | 1.00 [1.00–1.07] | 0.600 | not significant |
| **mobx** | 1.00 [1.00–1.07] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.07] | 0.600 | not significant |
| **jotai** | 1.07 [1.00–1.07] | 0.270 | not significant |

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
| **mobx** | 18.4 [14.5–23.1] | — | best |
| **rxjs** | 61.5 [60.6–66.2] | 0.012 | large |
| **jotai** | 76.4 [72.4–78.8] | 0.012 | large |
| **zustand** | 89.5 [84.1–94.4] | 0.012 | large |
| **redux** | 102.0 [100.1–115.0] | 0.012 | large |

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
| **zustand** | 17.7 [17.6–18.7] | — | best |
| **redux** | 17.7 [17.7–18.7] | 0.737 | not significant |
| **rxjs** | 17.7 [17.7–18.7] | 0.449 | not significant |
| **mobx** | 17.7 [17.7–18.6] | 0.518 | not significant |
| **jotai** | 17.7 [17.6–18.7] | 0.830 | not significant |

**Instrument row renders per quote** — optimal is 1.00; the metric's ceiling at this rate is 1.00, which is also the optimum, so this metric distinguishes nothing here.

| | rendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [0.99–1.01] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Position row renders per quote that touched a held instrument** — the metric
that caught MobX and Jotai deriving all six rows from one coarse computation.

| | positionRendersPerQuote, median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 1.00 [1.00–1.00] | — | best |
| **rxjs** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **mobx** | 1.00 [1.00–1.00] | 1.000 | not significant |
| **jotai** | 1.00 [0.99–1.01] | 1.000 | not significant |
| **redux** | 1.00 [1.00–1.00] | 1.000 | not significant |

**Total Blocking Time** — ms beyond the 50 ms long-task threshold.

| | totalBlockingMs (ms), median [95% CI] | vs. best (p) | effect |
|---|---:|---:|---|
| **zustand** | 0 [0–0] | — | best |
| **rxjs** | 0 [0–0] | 1.000 | not significant |
| **mobx** | 0 [0–0] | 1.000 | not significant |
| **jotai** | 0 [0–0] | 1.000 | not significant |
| **redux** | 0 [0–0] | 1.000 | not significant |

