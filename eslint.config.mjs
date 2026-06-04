import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const relaxedRules = {
  'no-undef': 'off',
  'no-fallthrough': 'off',
  'no-mixed-spaces-and-tabs': 'off',
  'no-redeclare': 'off',
  'no-with': 'off',
  'no-prototype-builtins': 'off',
  'no-misleading-character-class': 'off',
  'no-async-promise-executor': 'off',
  'no-import-assign': 'off',
};

const legacyGlobals = {
  ActiveXObject: 'readonly',
  XDomainRequest: 'readonly',
  ScriptEngine: 'readonly',
  WSH: 'readonly',
  WScript: 'readonly',
  DocumentTouch: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.turbo/**',
      'coverage/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    ...eslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      parserOptions: {
        ecmaFeatures: { jsx: true, globalReturn: true },
      },
      globals: {
        ...globals.es2021,
        ...globals.node,
        ...globals.browser,
        ...globals.jquery,
        ...globals.jasmine,
        ...globals.mocha,
        ...legacyGlobals,
      },
    },
    rules: {
      ...relaxedRules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': [
        'warn',
        { vars: 'local', args: 'after-used', ignoreRestSiblings: true },
      ],
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      ...relaxedRules,
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'local',
          args: 'after-used',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/prefer-namespace-keyword': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
);
