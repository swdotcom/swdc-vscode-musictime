export default [
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    rules: {
      "prefer-const": "warn",
      "no-constant-binary-expression": "error",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
];
