import { formatSignedMoney } from './format';
import { TESTID } from './testids';

export function AccountSummary(props: { totalPnl: number; usedRisk: number; drawdown: number }) {
  return (
    <div className="summary">
      <div className="summary__item">
        <span className="summary__label">Unrealized P&amp;L</span>
        <span data-testid={TESTID.accountPnl} className="summary__value">
          {formatSignedMoney(props.totalPnl)}
        </span>
      </div>
      <div className="summary__item">
        <span className="summary__label">Used risk</span>
        <span data-testid={TESTID.accountRisk} className="summary__value">
          {props.usedRisk.toFixed(2)}
        </span>
      </div>
      <div className="summary__item">
        <span className="summary__label">Drawdown</span>
        <span data-testid={TESTID.accountDrawdown} className="summary__value">
          {formatSignedMoney(props.drawdown)}
        </span>
      </div>
    </div>
  );
}
