/** @type {import("eslint").Linter.BaseConfig} */
module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  ignorePatterns: [".eslintrc.cjs", "example.*", "lib/"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    // project: ["./packages/*/tsconfig.json", "./packages/*/tsconfig.x.json"],
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // "prefer-const": "off",
    "@typescript-eslint/no-namespace": "off",
    // "@typescript-eslint/no-non-null-assertion": "off",
    // "@typescript-eslint/naming-convention": "warn",
    // "@typescript-eslint/no-var-requires": "off",
    // "@typescript-eslint/no-require-imports": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        /** Allow all unused args. */
        argsIgnorePattern: ".",
        /** Allow unused vars that start with an underscore. */
        varsIgnorePattern: "^_",
      },
    ],
    "no-useless-escape": "off",
    // "prefer-const": "off",

    // "node/no-missing-require": "off",
    // "node/no-extraneous-require": "off",
  },
};
