import { formatDuration, formatPercent, formatSignedMoney } from './format';
import { TESTID } from './testids';

export function StatsPanel(props: {
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgHoldingMs: number;
  tradeCount: number;
}) {
  return (
    <div className="stats">
      <div className="stats__item">
        <span className="stats__label">Win rate</span>
        <span data-testid={TESTID.statWinRate}>{formatPercent(props.winRate)}</span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Profit factor</span>
        <span data-testid={TESTID.statProfitFactor}>
          {Number.isFinite(props.profitFactor) ? props.profitFactor.toFixed(2) : '∞'}
        </span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Max drawdown</span>
        <span data-testid={TESTID.statMaxDrawdown}>{formatSignedMoney(props.maxDrawdown)}</span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Avg time in trade</span>
        <span data-testid={TESTID.statAvgHolding}>{formatDuration(props.avgHoldingMs)}</span>
      </div>
      <div className="stats__item">
        <span className="stats__label">Trades</span>
        <span data-testid={TESTID.statTradeCount}>{props.tradeCount}</span>
      </div>
    </div>
  );
}
