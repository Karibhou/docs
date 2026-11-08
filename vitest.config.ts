import { defineConfig } from "vitest/config";
import { transformWithEsbuild } from "vite";
import path from "path";

export default defineConfig({
  plugins: [
    {
      // mdx-components.js contains JSX in a .js file. Next.js compiles it via
      // SWC, but vitest's esbuild pipeline only parses JSX in .jsx/.tsx files,
      // so tests that import the docs page (which imports mdx-components.js)
      // need this file transformed with the JSX loader.
      name: "treat-mdx-components-js-as-jsx",
      async transform(code, id) {
        if (!id.endsWith("mdx-components.js")) return null;
        return transformWithEsbuild(code, id, {
          loader: "jsx",
          jsx: "automatic",
        });
      },
    },
  ],
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // scripts/ (prebuild sync + link checks) and netlify/ (NPS relay) ship
      // alongside src/ and have their own suites; keep them inside the gate so
      // a regression there cannot pass unnoticed.
      include: [
        "src/**/*.{ts,tsx}",
        "scripts/**/*.ts",
        "netlify/**/*.{ts,mts}",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
      // Ratchet: raise these as coverage grows; never lower without a reason
      // in the PR. Measured at the last ratchet: 99.81 / 100 / 97.51 / 99.33
      // (lines / functions / branches / statements), 1489 tests at 8a5b1f4.
      thresholds: {
        lines: 99,
        functions: 100,
        branches: 97,
        statements: 99,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
