import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-cleans when Vitest globals are enabled. They are
// not, so unmount explicitly — otherwise each render leaks into the next test
// and `getByTestId` starts finding duplicates.
afterEach(cleanup);
