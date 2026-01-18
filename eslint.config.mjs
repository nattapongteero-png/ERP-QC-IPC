import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude reference folder (external example code)
    "reference/**",
    // Exclude locale JSON files (validated by scripts/validate-i18n.ts)
    "src/locales/**/*.json",
  ]),
  // Custom rule overrides for this project
  {
    rules: {
      // Allow 'any' in database operations - Drizzle ORM dual-schema pattern requires it
      // See src/lib/db/db-helper.ts for documentation
      "@typescript-eslint/no-explicit-any": "warn",
      // Disable React Compiler rules - compiler is not enabled in next.config.ts
      // These rules are from eslint-plugin-react-hooks v6+ which includes React Compiler support
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/unsupported-syntax": "off",
    },
  },
]);

export default eslintConfig;
