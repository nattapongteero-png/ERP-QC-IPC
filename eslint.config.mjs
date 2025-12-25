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
  ]),
  // Custom rule overrides for this project
  {
    rules: {
      // Allow 'any' in database operations - Drizzle ORM dual-schema pattern requires it
      // See src/lib/db/db-helper.ts for documentation
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
