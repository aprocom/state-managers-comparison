# Contributing

The most valuable contribution to this project is **breaking one of its claims**. Eight of the eleven bugs listed in the README were found by adversarial review after the work had been written up as finished — three separate times — and the README assumes the next one is still unfound. If you are here to find it, start below.

## Challenging a number

Open an issue. Say which claim is wrong and what you ran. Useful reports include:

- The table, section and rate the claim comes from.
- Your `bench-results/latest.json`. The harness already records the commit, CPU model, core count, RAM and Node version in it, so attaching the file is enough — no need to describe your machine separately.
- Whether it reproduces across runs. A single run that disagrees with a published median is expected; the README says so about its own numbers, and the ordering inside the expensive CPU group did not replicate between two runs on the same machine.

Do not report benchmark numbers from CI, a VM or a laptop on battery. A shared runner has neither the thermal nor the scheduling stability for these measurements, which is why the benchmark job in CI is `continue-on-error` and gates nothing.

Reports that a *metric* is wrong — measuring something other than what it claims, or having no range in which to vary — are worth more than reports that a number is off. Two of the bugs in the README are of that kind, and both survived several rounds of people looking at the results.

## Before you open a pull request

```bash
npm run typecheck              # tsc --strict across nine projects
npm run lint
npm test                       # unit
npm run metrics -- --check     # fails if the README complexity table drifted from the code
npm run test:e2e               # both parity suites — the acceptance gate
```

CI runs exactly these. `npm run test:e2e` builds all five apps first; the whole set runs in about thirty seconds on an Apple M4.

If you touched `scripts/report.ts` or the samples, run `npm run report` and commit the regenerated `bench-results/report.md`. It is deterministic — the bootstrap and the tests are seeded, so the same input produces a byte-identical file.

Benchmarks are not required for a pull request and are not run by reviewers. `npm run bench` takes about 35 minutes.

## Changing an implementation

Two rules, and they are the whole reason the comparison means anything.

**Parity is the gate.** `e2e/parity.spec.ts` and `e2e/cross-app-parity.spec.ts` must pass unchanged. The second one requires all five apps to produce an *identical* derived-state vector, cell by cell. A change that makes one app faster and moves that vector is not an optimisation, it is a different app.

**Each library is written the way its own documentation says to write it.** Not the way that benchmarks best. An earlier version hand-rolled a memoiser Zustand ships and skipped two Redux APIs the comparison claims Redux is under test for, which meant the complexity axis was measuring the author rather than the libraries. If your change makes an implementation faster by leaving the idiomatic path, say so in the PR and expect that to be the discussion.

A change to one app's state layer usually needs the same change considered in the other four. If a library genuinely cannot express it, that asymmetry is itself a result — write it down rather than smoothing it over.

## Adding a sixth library

Open an issue first. It means a full implementation of both screens, the alert engine, unit tests, passing both parity suites and a benchmark re-run — and the README states the exclusion criteria for Recoil, XState and Effector, so a proposal should engage with those.

## Open gaps

Listed under **Status** in the README. Two concrete asks:

- **Concurrency safety** — running dai-shi's tearing suite against all five. Nothing in this project covers it.
- **An end-to-end test for an alert leaving the panel.** Blocked on the apps having no deterministic way to drive the store from the browser; the seeded feed cannot produce a clearing transition. The bug that shipped lived in the screen wiring, which the unit tests do not reach.
