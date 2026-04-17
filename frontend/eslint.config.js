// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
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
]);
