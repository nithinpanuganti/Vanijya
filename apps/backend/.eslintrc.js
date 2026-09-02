module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended'],
  root: true,
  env: { node: true, jest: true, es2021: true },
  rules: {
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-empty': 'warn',
  },
};
