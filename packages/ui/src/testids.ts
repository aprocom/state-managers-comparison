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

  instrumentRow: (id: string) => `instrument-row-${id}`,
  instrumentPrice: (id: string) => `instrument-price-${id}`,

  positionRow: (id: string) => `position-row-${id}`,
  positionPnl: (id: string) => `position-pnl-${id}`,

  accountPnl: 'account-pnl',
  accountRisk: 'account-risk',
  accountDrawdown: 'account-drawdown',

  alert: (kind: AlertKind) => `alert-${kind}`,
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
