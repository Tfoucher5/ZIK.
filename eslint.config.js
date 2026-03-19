import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  js.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "warn", // Ça devient un avertissement, plus une erreur bloquante
      "no-empty": "warn", // Pour tes blocs vides {}
      "svelte/no-navigation-without-resolve": "off", // On désactive le check des liens href
      "svelte/require-each-key": "warn", // On prévient mais on bloque pas
      "svelte/no-unused-svelte-ignore": "off",
    },
  },
  {
    ignores: ["build/", ".svelte-kit/", "dist/"],
  },
];
