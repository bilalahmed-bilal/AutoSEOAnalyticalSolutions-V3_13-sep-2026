import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Official Next.js 16 lint setup (ESLint CLI + eslint-config-next).
 * `next lint` was removed in Next 16; this is the supported replacement.
 *
 * Rule overrides are intentional, not ignored-by-default:
 * - no-explicit-any: tracked as G-17 / Phase 9. Mechanical `any` rewrites are forbidden.
 * - no-unescaped-entities: UI copy apostrophes; Next's own docs show this override.
 * - set-state-in-effect: real React 19 rule, but fixing it requires UI effect refactors
 *   in the large client page (Phase 10/18). Warn until those refactors are done.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "supabase/**",
    "data/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
