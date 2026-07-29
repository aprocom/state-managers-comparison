import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstrumentTable } from './InstrumentTable';
import type { InstrumentRowModel } from './InstrumentTable';
import { readRenderCounts, resetRenderCounts } from './renderCounter';
import { TESTID } from './testids';

const rows: InstrumentRowModel[] = [
  {
    id: 'BTC-USDT', label: 'BTC/USDT', price: 60000.456, precision: 2,
    changeDirection: 'up', pinned: false,
  },
  {
    id: 'ETH-USDT', label: 'ETH/USDT', price: 3000.1, precision: 2,
    changeDirection: 'down', pinned: false,
  },
];

const noop = () => {};

describe('InstrumentTable', () => {
  it('renders each instrument at its precision', () => {
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={noop} onTogglePin={noop} />);
    expect(screen.getByTestId(TESTID.instrumentPrice('BTC-USDT'))).toHaveTextContent('60000.46');
  });

  it('reports the clicked instrument', async () => {
    const onSelect = vi.fn();
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={onSelect} onTogglePin={noop} />);
    await userEvent.click(screen.getByTestId(TESTID.instrumentRow('ETH-USDT')));
    expect(onSelect).toHaveBeenCalledWith('ETH-USDT');
  });

  it('reports a pin toggle without also selecting the row', async () => {
    const onSelect = vi.fn();
    const onTogglePin = vi.fn();
    render(
      <InstrumentTable rows={rows} selectedId={null} onSelect={onSelect} onTogglePin={onTogglePin} />,
    );
    await userEvent.click(screen.getByTestId(TESTID.instrumentPin('ETH-USDT')));
    expect(onTogglePin).toHaveBeenCalledWith('ETH-USDT');
    expect(onSelect).not.toHaveBeenCalled();
  });

  /**
   * Counts actual renders rather than comparing DOM nodes. The previous version
   * of this test asserted that the `<tr>` element was the same object across a
   * rerender, which React guarantees whenever type and key match — it passed
   * with `memo` removed entirely and tested nothing.
   */
  it('does not re-render rows whose model is unchanged', () => {
    const { rerender } = render(
      <InstrumentTable rows={rows} selectedId={null} onSelect={noop} onTogglePin={noop} />,
    );
    resetRenderCounts();
    rerender(
      <InstrumentTable
        rows={[{ ...rows[0]!, price: 60001 }, rows[1]!]}
        selectedId={null}
        onSelect={noop}
        onTogglePin={noop}
      />,
    );
    expect(readRenderCounts().instrumentRow).toBe(1);
  });

  it('re-renders a row whose pinned flag changed', () => {
    const { rerender } = render(
      <InstrumentTable rows={rows} selectedId={null} onSelect={noop} onTogglePin={noop} />,
    );
    resetRenderCounts();
    rerender(
      <InstrumentTable
        rows={[rows[0]!, { ...rows[1]!, pinned: true }]}
        selectedId={null}
        onSelect={noop}
        onTogglePin={noop}
      />,
    );
    expect(readRenderCounts().instrumentRow).toBe(1);
    expect(screen.getByTestId(TESTID.instrumentPin('ETH-USDT'))).toHaveAttribute(
      'aria-pressed', 'true',
    );
  });

  it('re-renders every row when the handler identity changes', () => {
    const { rerender } = render(
      <InstrumentTable rows={rows} selectedId={null} onSelect={noop} onTogglePin={noop} />,
    );
    resetRenderCounts();
    rerender(
      <InstrumentTable rows={rows} selectedId={null} onSelect={() => {}} onTogglePin={noop} />,
    );
    // The regression guard for this project's most expensive bug: an inline
    // arrow in a screen defeats memoisation on every row at once.
    expect(readRenderCounts().instrumentRow).toBe(rows.length);
  });
});
