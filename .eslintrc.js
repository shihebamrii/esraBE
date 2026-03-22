module.exports = {
  env: {
    node: true,
    es2020: true,
    jest: true,
  },
  extends: ["eslint:recommended", "plugin:node/recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: ["node"],
  rules: {
    "no-console": "warn",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "node/no-unsupported-features/es-syntax": "off",
    "node/no-missing-require": "error",
    "prefer-const": "error",
    "no-var": "error",
  },
};
