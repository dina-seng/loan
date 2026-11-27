import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'apps/api/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['apps/**/*.js', 'apps/**/*.jsx', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Core ESLint does not count JSX tag references as variable usage.
    files: ['apps/**/*.jsx'],
    rules: { 'no-unused-vars': 'off' },
  },
];
