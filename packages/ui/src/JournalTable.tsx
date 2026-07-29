import { memo } from 'react';
import type { InstrumentId, Side } from '@smc/domain';
import { formatSignedMoney } from './format';
import { TESTID } from './testids';

export interface JournalRowModel {
  id: string;
  instrumentId: InstrumentId;
  side: Side;
  pnl: number;
  rMultiple: number;
  strategy: string;
  closedAt: number;
  note: string;
}

interface RowProps {
  row: JournalRowModel;
  strategies: string[];
  onEdit(id: string, patch: { strategy?: string; note?: string }): void;
}

const JournalRow = memo(function JournalRow({ row, strategies, onEdit }: RowProps) {
  return (
    <tr data-testid={TESTID.tradeRow(row.id)}>
      <td>{new Date(row.closedAt).toISOString().slice(0, 10)}</td>
      <td>{row.instrumentId}</td>
      <td>{row.side}</td>
      <td className={row.pnl < 0 ? 'pnl pnl--negative' : 'pnl pnl--positive'}>
        {formatSignedMoney(row.pnl)}
      </td>
      <td>{row.rMultiple.toFixed(2)}R</td>
      <td>
        <select
          data-testid={TESTID.tradeStrategy(row.id)}
          value={row.strategy}
          onChange={(event) => onEdit(row.id, { strategy: event.target.value })}
        >
          {strategies.map((strategy) => (
            <option key={strategy} value={strategy}>{strategy}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          data-testid={TESTID.tradeNote(row.id)}
          value={row.note}
          placeholder="note"
          onChange={(event) => onEdit(row.id, { note: event.target.value })}
        />
      </td>
    </tr>
  );
});

export function JournalTable(props: {
  rows: JournalRowModel[];
  strategies: string[];
  onEdit(id: string, patch: { strategy?: string; note?: string }): void;
}) {
  return (
    <table className="table">
      <thead>
        <tr><th>Closed</th><th>Instrument</th><th>Side</th><th>P&amp;L</th><th>R</th><th>Strategy</th><th>Note</th></tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <JournalRow key={row.id} row={row} strategies={props.strategies} onEdit={props.onEdit} />
        ))}
      </tbody>
    </table>
  );
}
