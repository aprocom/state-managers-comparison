import type { AlertKind } from '@smc/domain';

/**
 * The contract between every implementation and the single Playwright suite.
 * Adding a selector here is a cross-app change: all five apps must satisfy it.
 */
export const TESTID = {
  screenTerminal: 'screen-terminal',
  screenJournal: 'screen-journal',
  navTerminal: 'nav-terminal',
  navJournal: 'nav-journal',
  feedRate: (rate: number) => `feed-rate-${rate}`,

  instrumentTable: 'instrument-table',
  instrumentRow: (id: string) => `instrument-row-${id}`,
  instrumentPrice: (id: string) => `instrument-price-${id}`,
  instrumentPin: (id: string) => `instrument-pin-${id}`,

  positionRow: (id: string) => `position-row-${id}`,
  positionPnl: (id: string) => `position-pnl-${id}`,

  accountPnl: 'account-pnl',
  accountRisk: 'account-risk',
  accountDrawdown: 'account-drawdown',
  accountPinned: 'account-pinned',

  /** Includes the subject: the seeded fixture raises several time-in-trade
   *  alerts at once, and a kind-only id matches all of them, which fails
   *  Playwright's strict mode and silently weakens any assertion using it. */
  alert: (kind: AlertKind, subjectId?: string) => (subjectId === undefined
    ? `alert-${kind}`
    : `alert-${kind}-${subjectId}`),
  alertList: 'alert-list',

  tradeRow: (id: string) => `trade-row-${id}`,
  tradeStrategy: (id: string) => `trade-strategy-${id}`,
  tradeNote: (id: string) => `trade-note-${id}`,

  filterStrategy: 'filter-strategy',
  filterSide: 'filter-side',
  filterInstrument: 'filter-instrument',

  statWinRate: 'stat-win-rate',
  statProfitFactor: 'stat-profit-factor',
  statMaxDrawdown: 'stat-max-drawdown',
  statAvgHolding: 'stat-avg-holding',
  statTradeCount: 'stat-trade-count',

  equityChart: 'equity-chart',
  renderCount: 'render-count',
} as const;
