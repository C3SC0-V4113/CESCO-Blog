import { plugin as shadcn } from '@shadcn/lint';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginAstro from 'eslint-plugin-astro';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults';
import importPlugin from 'eslint-plugin-import';
import playwrightPlugin from 'eslint-plugin-playwright';
import reactDoctor from 'eslint-plugin-react-doctor';
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import tseslint from 'typescript-eslint';

// Keep built-in class attributes while limiting helper-call linting to our APIs.
const tailwindSelectors = getDefaultSelectors().filter(
  (selector) => selector.kind !== 'callee' || selector.name === '^cn$' || selector.name === '^cva$'
);

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['**/*.{ts,tsx,astro}'],
    plugins: {
      'better-tailwindcss': betterTailwindcss,
    },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'src/styles/global.css',
        selectors: tailwindSelectors,
      },
    },
    rules: {
      'better-tailwindcss/enforce-canonical-classes': 'error',
      'better-tailwindcss/enforce-shorthand-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'error',
      'better-tailwindcss/no-restricted-classes': [
        'error',
        {
          restrict: [
            {
              pattern: '^(?:.+:)?text-primary(?:/[0-9]{1,3})?!?$',
              message: 'use text-brand for accent text; text-primary is a fill colour',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      shadcn,
    },
    settings: {
      shadcn: {
        ui: '@/components/ui',
        componentImports: ['^@/components/ui(/|$)'],
        mergeFunctions: ['cn'],
        variantFunctions: ['cva', 'buttonVariants', 'linkVariants', 'adminPostsTableVariants'],
        themeImports: ['(?:^|/)styles/global\\.css$'],
      },
    },
    rules: {
      // Allow placement on the parent while components retain visual styling.
      'shadcn/no-restyle': [
        'error',
        {
          allow: [
            'm-*',
            'mx-*',
            'my-*',
            'mt-*',
            'mr-*',
            'mb-*',
            'ml-*',
            'ms-*',
            'me-*',
            'w-full',
            'w-auto',
            'min-w-0',
            'min-w-*',
            'max-w-*',
            'flex-1',
            'flex-none',
            'grow',
            'shrink-0',
            'self-*',
            'justify-self-*',
            'col-span-*',
            'row-span-*',
            'order-*',
            'hidden',
            'block',
            'flex',
            'inline-flex',
            'grid',
          ],
        },
      ],
      'shadcn/no-raw-colors': 'error',
      // Keep only browser insets, viewport bounds, and the OG image overlap as one-off values.
      'shadcn/no-arbitrary-values': [
        'error',
        {
          allow: [
            'md:min-h-[calc(100dvh-4rem)]',
            'max-h-[calc(100dvh-2rem)]',
            'pb-[env(safe-area-inset-bottom)]',
            'mt-[-52.35%]',
          ],
        },
      ],
      'shadcn/no-inline-styles': 'error',
      'shadcn/no-unknown-classes': 'error',
      'shadcn/require-static-classes': 'error',
    },
  },
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
    // ADR-0023: the admin is a separate client-rendered application. Public code
    // that imports from it drags the editor, its dictionary and its dependencies
    // into routes that promise near-zero JavaScript. Only the admin's own pages,
    // layout and components may reach into src/components/admin/.
    files: ['src/**/*.{astro,ts,tsx}'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: [
                './src/*.ts',
                './src/actions/**',
                './src/components/!(admin)/**',
                './src/db/**',
                './src/i18n/**',
                './src/layouts/!(admin).astro',
                './src/lib/**',
                './src/pages/*.{astro,ts}',
                './src/pages/!(admin)/**',
              ],
              from: './src/components/admin',
              message: 'Public code must not import the admin application (ADR-0023).',
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
      // A leading underscore marks a parameter kept for its position or for a
      // signature callers already depend on, but not read yet.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
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
  {
    files: ['tests/unit/setup.ts'],
    rules: {
      // The shared Vitest setup must register cleanup because Vitest globals are disabled.
      'testing-library/no-manual-cleanup': 'off',
    },
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
