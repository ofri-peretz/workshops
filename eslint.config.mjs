// @ts-check
/**
 * Our own lint plugins, each with its `recommended` preset, over the relay,
 * scripts, e2e and the console app. `npm run lint`.
 *
 * Plugins are picked by what the code imports: node builtins and a Next/React
 * console. browser-security, react-a11y and react-features apply to the console
 * only, since it is the one thing here that renders in a browser.
 */
import tseslint from 'typescript-eslint';
import { configs as secureCoding } from 'eslint-plugin-secure-coding';
import { configs as nodeSecurity } from 'eslint-plugin-node-security';
import { configs as maintainability } from 'eslint-plugin-maintainability';
import { configs as reliability } from 'eslint-plugin-reliability';
import { configs as conventions } from 'eslint-plugin-conventions';
import { configs as operability } from 'eslint-plugin-operability';
import { configs as modernization } from 'eslint-plugin-modernization';
import { configs as modularity } from 'eslint-plugin-modularity';
import { configs as importNext } from 'eslint-plugin-import-next';
import { configs as browserSecurity } from 'eslint-plugin-browser-security';
import { configs as reactA11y } from 'eslint-plugin-react-a11y';
import { configs as reactFeatures } from 'eslint-plugin-react-features';

const CODE = ['**/*.{js,mjs,cjs,ts,tsx}'];
const CONSOLE_UI = ['console/**/*.tsx'];

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next*/**', // .next and the e2e build's .next-e2e
      'test-results/**',
      'playwright-report/**',
      'reports/**',
      'console/next-env.d.ts',
    ],
  },
  {
    files: CODE,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
  },
  ...[
    secureCoding,
    nodeSecurity,
    maintainability,
    reliability,
    conventions,
    operability,
    modernization,
    modularity,
    importNext,
  ].map((c) => ({ ...c.recommended, files: CODE })),
  ...[browserSecurity, reactA11y, reactFeatures].map((c) => ({
    ...c.recommended,
    files: CONSOLE_UI,
  })),
  // ── Ratchet (2026-11-18) ──────────────────────────────────────────────
  // Every preset rule at `warn` that has zero findings here, raised to `error` so a
  // new one fails the lint. Rules still at `warn` have open findings (see the PR).
  {
    // Zero hits on the whole tree.
    files: CODE,
    rules: {
      'conventions/expiring-todo-comments': 'error',
      'conventions/no-deprecated-api': 'error',
      'import-next/namespace': 'error',
      'import-next/no-amd': 'error',
      'import-next/no-empty-named-blocks': 'error',
      'import-next/no-named-as-default': 'error',
      'import-next/no-named-as-default-member': 'error',
      'modernization/prefer-at': 'error',
      'modernization/prefer-event-target': 'error',
      'modernization/prefer-template-literal': 'error',
      'modularity/ddd-anemic-domain-model': 'error',
      'modularity/enforce-naming': 'error',
      'modularity/no-mutable-exports': 'error',
      'node-security/detect-non-literal-fs-filename': 'error',
      'node-security/detect-suspicious-dependencies': 'error',
      'node-security/no-buffer-overread': 'error',
      'node-security/no-ssrf': 'error',
      'node-security/no-timing-unsafe-compare': 'error',
      'node-security/no-unsafe-buffer-alloc': 'error',
      'operability/no-console-log': 'error',
      'operability/no-verbose-error-messages': 'error',
      'secure-coding/no-graphql-injection': 'error',
      'secure-coding/no-privilege-escalation': 'error',
      'secure-coding/no-sensitive-data-exposure': 'error',
      'secure-coding/no-unlimited-resource-allocation': 'error',
      'secure-coding/no-unsafe-deserialization': 'error',
      'secure-coding/no-weak-password-recovery': 'error',
    },
  },
  {
    // Zero hits in the console UI.
    files: CONSOLE_UI,
    rules: {
      'browser-security/require-blob-url-revocation': 'error',
      'react-a11y/anchor-ambiguous-text': 'error',
      'react-a11y/anchor-is-valid': 'error',
      'react-a11y/aria-activedescendant-has-tabindex': 'error',
      'react-a11y/autocomplete-valid': 'error',
      'react-a11y/img-redundant-alt': 'error',
      'react-a11y/media-has-caption': 'error',
      'react-a11y/mouse-events-have-key-events': 'error',
      'react-a11y/no-access-key': 'error',
      'react-a11y/no-autofocus': 'error',
      'react-a11y/no-interactive-element-to-noninteractive-role': 'error',
      'react-a11y/no-noninteractive-element-interactions': 'error',
      'react-a11y/no-noninteractive-element-to-interactive-role': 'error',
      'react-a11y/no-noninteractive-tabindex': 'error',
      'react-a11y/no-redundant-roles': 'error',
      'react-a11y/no-static-element-interactions': 'error',
      'react-a11y/prefer-tag-over-role': 'error',
      'react-a11y/tabindex-no-positive': 'error',
      'react-features/hooks-exhaustive-deps': 'error',
      'react-features/no-children-prop': 'error',
      'react-features/no-danger': 'error',
      'react-features/no-deprecated': 'error',
    },
  },
  {
    files: ['console/**/*.{ts,tsx}'],
    rules: {
      // `@/` is the console's tsconfig path alias, not a package (FP ofri-peretz/eslint#1551).
      'import-next/no-extraneous-dependencies': ['error', { allowPatterns: ['^@/'] }],
    },
  },
  {
    // lib/ is the console's API-client layer: talking to Supabase and the relay is its job.
    files: ['console/lib/**/*.ts'],
    rules: { 'modularity/no-external-api-calls-in-utils': 'off' },
  },
  {
    // Tests run from the root, which declares vitest; relay/package.json is the deploy manifest.
    files: ['relay/**/*.test.mjs'],
    rules: { 'import-next/no-extraneous-dependencies': ['error', { ignore: ['vitest'] }] },
  },
  {
    // The relay's in-process test server: the test runner bounds every request.
    files: ['relay/test.mjs', '**/*.test.mjs'],
    rules: { 'reliability/require-network-timeout': 'off' },
  },
  {
    // Command-line entry points: printing to the operator's terminal is their output.
    files: ['relay/server.mjs', 'relay/test.mjs', 'relay/rehearsal/build.mjs', 'scripts/**'],
    rules: {
      'operability/no-console-log': 'off',
      'operability/no-debug-code-in-production': 'off',
    },
  },
];
