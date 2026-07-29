import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstrumentTable } from './InstrumentTable';
import { TESTID } from './testids';

const rows = [
  { id: 'BTC-USDT', label: 'BTC/USDT', price: 60000.456, precision: 2, changeDirection: 'up' as const },
  { id: 'ETH-USDT', label: 'ETH/USDT', price: 3000.1, precision: 2, changeDirection: 'down' as const },
];

describe('InstrumentTable', () => {
  it('renders each instrument at its precision', () => {
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId(TESTID.instrumentPrice('BTC-USDT'))).toHaveTextContent('60000.46');
  });

  it('reports the clicked instrument', async () => {
    const onSelect = vi.fn();
    render(<InstrumentTable rows={rows} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByTestId(TESTID.instrumentRow('ETH-USDT')));
    expect(onSelect).toHaveBeenCalledWith('ETH-USDT');
  });

  it('does not re-render rows whose model is unchanged', () => {
    const { rerender } = render(<InstrumentTable rows={rows} selectedId={null} onSelect={() => {}} />);
    const before = screen.getByTestId(TESTID.instrumentRow('ETH-USDT'));
    rerender(<InstrumentTable rows={[{ ...rows[0]!, price: 60001 }, rows[1]!]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId(TESTID.instrumentRow('ETH-USDT'))).toBe(before);
  });
});
