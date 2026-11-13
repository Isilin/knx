import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

// https://viteplus.dev/config/
export default defineConfig({
  // NEXT_PUBLIC_* comes from the Vercel ↔ Supabase integration; only public keys use it.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  fmt: {
    ignorePatterns: [
      "public/data/**",
      "supabase/seed.sql",
      "data/**",
      "dist/**",
      ".impeccable/**",
      "PRODUCT.md",
      "README.md",
      "DESIGN.md",
      "docs/**",
    ],
  },
  lint: {
    ignorePatterns: ["dist/**", "public/data/**", ".impeccable/**"],
    plugins: ["react", "typescript", "oxc"],
    rules: {
      "react/rules-of-hooks": "error",
      "react/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          // Context hooks live next to their provider; tiny helpers next to their component.
          allowExportNames: [
            "useData",
            "useMarket",
            "useFocus",
            "groupColor",
            "sealGeometry",
            "PERIODS",
            "periodStart",
          ],
        },
      ],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
  plugins: lazyPlugins(() => [react()]),
});
