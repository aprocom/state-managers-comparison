import { describe, expect, it } from 'vitest';
import { DOMAIN_VERSION } from './index';

describe('domain package', () => {
  it('is resolvable and exports its version marker', () => {
    expect(DOMAIN_VERSION).toBe('0.1.0');
  });
});
