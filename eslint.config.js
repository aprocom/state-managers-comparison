import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Type-aware linting across all nine projects.
 *
 * The rules that matter here are the ones a comparison like this can be
 * silently wrong about: the exhaustive-deps rule guards the effect wiring that
 * drives the feed in five separate screens, and the no-floating-promises and
 * no-misused-promises rules guard the async benchmark harness. Everything else
 * is the recommended set.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**', '**/node_modules/**', 'bench-results/**', 'playwright-report/**',
      // The assembled Pages site is copied build output, not source.
      'site/**',
      // The config cannot type-check itself: @eslint/js ships no types.
      'eslint.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-level config files are not members of any app tsconfig.
          allowDefaultProject: [
            'playwright.config.ts', 'vitest.config.ts', 'vitest.setup.ts', 'eslint.config.js',
            'scripts/*.ts', 'scripts/*.mjs',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // An underscore-prefixed parameter is the conventional way to say "this
      // exists to satisfy the signature". atomFamily's key parameter is one.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Its page.evaluate() callback is serialised into Chromium and runs there,
    // so `document` is defined at the point it is used and nowhere else.
    files: ['scripts/check-preview.mjs'],
    languageOptions: { globals: { document: 'readonly' } },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Test files legitimately reach for non-null assertions on fixture data.
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      // `window` is here for the throttle probe, whose page callbacks run in
      // the browser rather than in node.
      globals: {
        process: 'readonly',
        URL: 'readonly',
        console: 'readonly',
        window: 'readonly',
        performance: 'readonly',
      },
    },
  },
  {
    // Passing a store method or a prop callback as a value is the intended API
    // in every one of these libraries and in React itself.
    files: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/ui/**/*.tsx'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    // Vite's plugin types do not resolve through the workspace root.
    files: ['vitest.config.ts', 'playwright.config.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
