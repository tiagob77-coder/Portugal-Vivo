// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Plugin-specific overrides must scope to the files where the plugin
    // is registered. @typescript-eslint is registered by expo-config only
    // for ts/tsx/d.ts, so the override must match the same files.
    files: ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // FE-001 — the rule is left at the expo-config default ('off' for
      // legacy reasons). Switching it on (even at 'warn') made `expo lint`
      // fail because the runner uses --max-warnings 0 by default and the
      // codebase still has ~150 audit-tracked `any` usages. Re-enable once
      // they are migrated file-by-file:
      // '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    rules: {
      'import/no-named-as-default': 'off',
    },
  },
  {
    // Warn (not error) when a raw hex colour is hardcoded inside src/components.
    // Use palette / theme tokens instead so theming stays consistent.
    files: ['src/components/**/*.tsx', 'src/components/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: `Literal[value=/^#[0-9a-fA-F]{3,8}$/]`,
          message:
            'Hardcoded hex colour detected. Use a palette token from src/theme instead.',
        },
      ],
    },
  },
];
