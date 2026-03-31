module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
    es2020: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    // TypeScript rules
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/prefer-readonly': 'warn',
    
    // Security rules (manually defined to avoid plugin issues)
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'warn',
    'no-caller': 'error',
    'no-extend-native': 'error',
    'no-proto': 'error',
    'no-iterator': 'error',
    'no-with': 'error',
    
    // General rules
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'curly': 'warn',
    'no-throw-literal': 'error',
    'no-unused-expressions': 'error',
    'no-useless-concat': 'error',
    'no-useless-escape': 'warn',
    'radix': 'warn',
    'yoda': 'error',
    'no-case-declarations': 'warn'
  },
  settings: {
    'import/resolver': {
      typescript: {}
    }
  },
  overrides: [
    {
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ],
  ignorePatterns: ['tests/**/*', '**/*.test.ts', '**/*.spec.ts', 'src/plugins/angular-captcha.component.ts']
};
