import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginAstro from 'eslint-plugin-astro';
import importPlugin from 'eslint-plugin-import';
import playwrightPlugin from 'eslint-plugin-playwright';
import reactDoctor from 'eslint-plugin-react-doctor';
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    ...reactDoctor.configs.recommended,
    files: ['**/*.{jsx,tsx}'],
  },
  {
    ...reactYouMightNotNeedAnEffect.configs.recommended,
    files: ['**/*.{jsx,tsx}'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,astro}'],
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Command-line scripts report progress on stdout; that is their interface,
    // not stray debugging left behind.
    files: ['scripts/**/*.{js,mjs,cjs,ts,mts,cts}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // ADR-0031, rule 1: a page routes and shapes a response. Reaching for the
    // query builder there puts data access somewhere no integration test covers.
    files: ['src/pages/**/*.{astro,ts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['drizzle-orm', 'drizzle-orm/*'],
              message:
                'Pages do not query directly (ADR-0031). Call a function from src/db/queries/ instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // ADR-0031, rule 2: a component receives data as props. Naming the shape is
    // fine — `allowTypeImports` keeps `import type { PublishedPost }` legal —
    // but importing the module that can fetch it is not.
    files: ['src/components/**/*.{astro,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/db', '@/db/*', 'drizzle-orm', 'drizzle-orm/*'],
              allowTypeImports: true,
              message:
                'Components take data as props (ADR-0031). Fetch in the page and pass it down.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    files: [
      '**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      'tests/unit/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      'tests/integration/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
    ],
    ignores: ['tests/e2e/**', 'e2e/**', 'playwright/**'],
    plugins: vitest.configs.recommended.plugins,
    languageOptions: vitest.configs.env.languageOptions,
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/no-disabled-tests': 'warn',
      'vitest/no-focused-tests': 'error',
    },
  },
  {
    files: [
      '**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      'tests/unit/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      'tests/integration/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
    ],
    ignores: ['tests/e2e/**', 'e2e/**', 'playwright/**'],
    ...testingLibraryPlugin.configs['flat/react'],
  },
  {
    files: [
      'tests/e2e/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      'e2e/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      'playwright/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
    ],
    ...playwrightPlugin.configs['flat/recommended'],
  },
  eslintConfigPrettier,
  globalIgnores([
    'dist/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.agents/**',
    '.claude/**',
    '.astro/**',
    '.wrangler/**',
    'src/env.d.ts',
    'src/components/ui/**',
  ]),
]);
export default eslintConfig;
