import { describe, expect, it } from 'vitest';
import { formatPercent, formatPrice, formatSignedMoney } from './format';

describe('formatPrice', () => {
  it('respects the instrument precision', () => {
    expect(formatPrice(60000.456, 2)).toBe('60000.46');
    expect(formatPrice(0.123456, 5)).toBe('0.12346');
  });
});

describe('formatSignedMoney', () => {
  it('always shows a sign so gains and losses are unambiguous', () => {
    expect(formatSignedMoney(1240)).toBe('+1240.00');
    expect(formatSignedMoney(-380)).toBe('-380.00');
    expect(formatSignedMoney(0)).toBe('+0.00');
  });
});

describe('formatPercent', () => {
  it('renders a fraction as a whole percentage', () => {
    expect(formatPercent(0.61)).toBe('61%');
    expect(formatPercent(0)).toBe('0%');
  });
});
