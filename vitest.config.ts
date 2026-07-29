import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['packages/domain/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: ['packages/ui/**/*.test.{ts,tsx}', 'apps/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          // jsdom-only: the setup file pulls in Testing Library, which needs a DOM.
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
