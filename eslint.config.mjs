import js from '@eslint/js';
import ts from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

/**
 * Flat ESLint config.
 *
 * Built directly from `@next/eslint-plugin-next` + `typescript-eslint` rather
 * than from `eslint-config-next`, because that preset depends on
 * `@rushstack/eslint-patch`, which patches ESLint internals and fails outright
 * under ESLint 9 ("Failed to patch ESLint because the calling module was not
 * recognized"). Composing the two plugins directly is the flat-config-native
 * equivalent, keeps the same rule coverage, and drops the patching dependency.
 *
 * Scope is deliberately narrow: catch real defects (unused code, hook misuse,
 * unsafe promises), not formatting, which `tsc` and the existing conventions
 * already cover.
 */
export default ts.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'dist/**',
      'coverage/**',
      // Next.js generates this file; it must not be linted or edited.
      'next-env.d.ts',
      // Maintenance scripts report their results on stdout; that IS their
      // output, so the no-console rule does not apply to them.
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,

      // Unused code is a maintenance cost, not a style preference: the OSS
      // integration audit removed ~15 dead exports from this repo.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // This app has no console output by design; a stray log would be the
      // only place user CSV data could leak.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',

      // Variant keys join handle + three option values with U+0000. The NUL
      // separator is deliberate: it cannot occur in CSV field data, so the key
      // is unambiguous. It appears inside a regex only for display.
      'no-control-regex': 'off',
    },
  },
);
