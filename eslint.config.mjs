import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "public/**", "*.config.js", "*.config.ts"],
  },
  js.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];

export default eslintConfig;
