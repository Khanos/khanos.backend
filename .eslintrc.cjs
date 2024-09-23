module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:jest/recommended',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
    presets: ['@babel/preset-env'],
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  overrides: [{
    env: {
        node: true,
    },
    files: [
        '.eslintrc.{js,cjs}',
    ],
    parserOptions: {
        sourceType: 'script',
    },
  }],
  plugins: ['jest'],
  rules: {
      // Add your custom rules here
  },
};