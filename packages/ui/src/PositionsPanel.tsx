import { memo } from 'react';
import type { InstrumentId, Side } from '@smc/domain';
import { formatPrice, formatSignedMoney } from './format';
import { countRender } from './renderCounter';
import { TESTID } from './testids';

export interface PositionRowModel {
  id: string;
  instrumentId: InstrumentId;
  side: Side;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
}

const PositionRow = memo(function PositionRow({ row }: { row: PositionRowModel }) {
  countRender('positionRow');
  return (
    <tr data-testid={TESTID.positionRow(row.id)}>
      <td>{row.instrumentId}</td>
      <td>{row.side}</td>
      <td>{row.size}</td>
      <td>{formatPrice(row.entryPrice, 2)}</td>
      <td>{formatPrice(row.markPrice, 2)}</td>
      <td
        data-testid={TESTID.positionPnl(row.id)}
        className={row.unrealizedPnl < 0 ? 'pnl pnl--negative' : 'pnl pnl--positive'}
      >
        {formatSignedMoney(row.unrealizedPnl)}
      </td>
    </tr>
  );
});

export function PositionsPanel({ rows }: { rows: PositionRowModel[] }) {
  return (
    <table className="table">
      <thead>
        <tr><th>Instrument</th><th>Side</th><th>Size</th><th>Entry</th><th>Mark</th><th>P&amp;L</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => <PositionRow key={row.id} row={row} />)}
      </tbody>
    </table>
  );
}
