module.exports = {
  env: {
    browser: false,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'standard'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
    // Custom rules for your project
    'no-console': 'warn',
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
    'indent': ['error', 2],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    'comma-dangle': ['error', 'never'],
    'space-before-function-paren': ['error', 'never']
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    'build/',
    '*.min.js'
  ]
};
