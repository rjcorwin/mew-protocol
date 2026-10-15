import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [{
  files: ['prototypes/mewpod-v2/**/*.ts'],
  languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
  plugins: { '@typescript-eslint': tsPlugin },
  rules: {
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    'no-duplicate-case': 'error',
    'no-unsafe-finally': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
  },
}];
