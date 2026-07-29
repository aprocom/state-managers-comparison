import { memo } from 'react';
import type { InstrumentId } from '@smc/domain';
import { formatPrice } from './format';
import { TESTID } from './testids';

export interface InstrumentRowModel {
  id: InstrumentId;
  label: string;
  price: number;
  precision: number;
  changeDirection: 'up' | 'down' | 'flat';
}

interface RowProps {
  row: InstrumentRowModel;
  selected: boolean;
  onSelect(id: InstrumentId): void;
}

/**
 * Memoised on purpose. Implementations that push a new object per tick will
 * re-render every row; implementations with fine-grained subscriptions will
 * not. That difference is a headline metric, so the component must not hide it.
 */
const InstrumentRow = memo(function InstrumentRow({ row, selected, onSelect }: RowProps) {
  return (
    <tr
      data-testid={TESTID.instrumentRow(row.id)}
      className={selected ? 'row row--selected' : 'row'}
      onClick={() => onSelect(row.id)}
    >
      <td>{row.label}</td>
      <td data-testid={TESTID.instrumentPrice(row.id)} className={`price price--${row.changeDirection}`}>
        {formatPrice(row.price, row.precision)}
      </td>
    </tr>
  );
});

export function InstrumentTable(props: {
  rows: InstrumentRowModel[];
  selectedId: InstrumentId | null;
  onSelect(id: InstrumentId): void;
}) {
  return (
    <table className="table">
      <thead>
        <tr><th>Instrument</th><th>Price</th></tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <InstrumentRow
            key={row.id}
            row={row}
            selected={row.id === props.selectedId}
            onSelect={props.onSelect}
          />
        ))}
      </tbody>
    </table>
  );
}
