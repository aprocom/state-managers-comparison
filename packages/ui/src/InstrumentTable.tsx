import { memo } from 'react';
import type { InstrumentId } from '@smc/domain';
import { formatPrice } from './format';
import { countRender } from './renderCounter';
import { TESTID } from './testids';

export interface InstrumentRowModel {
  id: InstrumentId;
  label: string;
  price: number;
  precision: number;
  changeDirection: 'up' | 'down' | 'flat';
  pinned: boolean;
}

interface RowProps {
  row: InstrumentRowModel;
  selected: boolean;
  onSelect(id: InstrumentId): void;
  onTogglePin(id: InstrumentId): void;
}

/**
 * Memoised on purpose. Implementations that push a new object per tick will
 * re-render every row; implementations with fine-grained subscriptions will
 * not. That difference is a headline metric, so the component must not hide it.
 */
const InstrumentRow = memo(function InstrumentRow(
  { row, selected, onSelect, onTogglePin }: RowProps,
) {
  countRender('instrumentRow');
  return (
    <tr
      data-testid={TESTID.instrumentRow(row.id)}
      className={selected ? 'row row--selected' : 'row'}
      // Keyboard-reachable: the row is the primary control on this screen and a
      // mouse-only selection is not an acceptable primary interaction.
      tabIndex={0}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        // Only when the row itself has focus. Without this check the pin
        // button's own Space and Enter bubble up here, get preventDefault'd,
        // and select the row instead of toggling the pin.
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.id);
        }
      }}
    >
      <td>
        <button
          type="button"
          data-testid={TESTID.instrumentPin(row.id)}
          className={row.pinned ? 'pin pin--on' : 'pin'}
          aria-pressed={row.pinned}
          aria-label={`${row.pinned ? 'Unpin' : 'Pin'} ${row.label}`}
          onClick={(event) => { event.stopPropagation(); onTogglePin(row.id); }}
        >
          {row.pinned ? '\u2605' : '\u2606'}
        </button>
      </td>
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
  onTogglePin(id: InstrumentId): void;
}) {
  return (
    <table className="table" data-testid={TESTID.instrumentTable}>
      <thead>
        <tr><th aria-label="Pinned" /><th>Instrument</th><th>Price</th></tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <InstrumentRow
            key={row.id}
            row={row}
            selected={row.id === props.selectedId}
            onSelect={props.onSelect}
            onTogglePin={props.onTogglePin}
          />
        ))}
      </tbody>
    </table>
  );
}
