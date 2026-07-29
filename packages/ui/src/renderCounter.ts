/**
 * Counts row renders so the benchmark can compare how many components each
 * state manager actually re-renders per quote. Lives in the shared UI package
 * on purpose: every implementation renders the same instrumented components,
 * so the count measures the state layer and nothing else.
 */
interface RenderCounts {
  instrumentRow: number;
  positionRow: number;
  journalRow: number;
}

declare global {
  var __SMC_RENDERS__: RenderCounts | undefined;
}

function counts(): RenderCounts {
  globalThis.__SMC_RENDERS__ ??= { instrumentRow: 0, positionRow: 0, journalRow: 0 };
  return globalThis.__SMC_RENDERS__;
}

export function countRender(kind: keyof RenderCounts): void {
  counts()[kind] += 1;
}

export function readRenderCounts(): RenderCounts {
  return { ...counts() };
}

export function resetRenderCounts(): void {
  globalThis.__SMC_RENDERS__ = { instrumentRow: 0, positionRow: 0, journalRow: 0 };
}
