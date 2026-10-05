import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import prettier from "eslint-config-prettier";

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
    "node_modules/**",
  ]),
  {
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/elements": [
        {
          type: "domain",
          pattern: "src/modules/*/domain/**",
          partialMatch: false,
        },
        {
          type: "application",
          pattern: "src/modules/*/application/**",
          partialMatch: false,
        },
        {
          type: "infrastructure",
          pattern: "src/modules/*/infrastructure/**",
          partialMatch: false,
        },
        {
          type: "presentation",
          pattern: ["src/modules/*/presentation/**", "src/app/**"],
          partialMatch: false,
        },
        {
          type: "shared",
          pattern: "src/shared/**",
          partialMatch: false,
        },
        {
          type: "di",
          pattern: "src/di/**",
          partialMatch: false,
        },
      ],
      "boundaries/ignore": ["**/*.test.*", "**/*.spec.*"],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: { element: { type: "domain" } },
              allow: {
                to: { element: { types: { anyOf: ["domain", "shared"] } } },
              },
              message:
                "Domain layer cannot import from Application, Infrastructure, or Presentation layers.",
            },
            {
              from: { element: { type: "application" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["domain", "application", "shared"] },
                  },
                },
              },
              message:
                "Application layer can only import from Domain and Shared layers.",
            },
            {
              from: { element: { type: "infrastructure" } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        "domain",
                        "application",
                        "infrastructure",
                        "shared",
                      ],
                    },
                  },
                },
              },
              message:
                "Infrastructure layer cannot import from Presentation layer.",
            },
            {
              from: { element: { type: "presentation" } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        "application",
                        "domain",
                        "presentation",
                        "shared",
                        "di",
                      ],
                    },
                  },
                },
              },
              message:
                "Presentation layer cannot import directly from Infrastructure layer. Use the DI container (composition root) to obtain use cases.",
            },
            {
              from: { element: { type: "shared" } },
              allow: {
                to: { element: { type: "shared" } },
              },
              message:
                "Shared layer cannot import from feature modules or Presentation layer.",
            },
            {
              from: { element: { type: "di" } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        "domain",
                        "application",
                        "infrastructure",
                        "presentation",
                        "shared",
                        "di",
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
  prettier,
]);

export default eslintConfig;
