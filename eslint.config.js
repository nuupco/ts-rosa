// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['src/**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@getodk/common/lib/dom/*', '@getodk/common/lib/dom'],
              message:
                'Do not import from @getodk/common/lib/dom/* — browser-DOM-coupled code. Use xmldom APIs directly.',
            },
            {
              group: [
                '@getodk/common/lib/web-compat/*',
                '@getodk/common/lib/web-compat',
              ],
              message:
                'Do not import from @getodk/common/lib/web-compat/* — browser-compat shims not safe for Hermes/xmldom.',
            },
          ],
        },
      ],
    },
  },
];
