/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import header from "@tony.ganchev/eslint-plugin-header";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import html from "eslint-plugin-html";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [
  {
    ignores: ['**/node_modules/', '**/dist/', '**/daemon/', '**/test/'],
  },
  ...compat.extends('eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      header,
      html,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'error',
      camelcase: 'error',
      eqeqeq: ['error', 'smart'],
      'header/header': [
        'error',
        'block',
        [
          '',
          {
            pattern: ' \\* Copyright \\(C\\) (\\d{4}|(\\d{4}-\\d{4})) Savoir-faire Linux Inc\\.',
            template: ' * Copyright (C) 2025 Savoir-faire Linux Inc.',
          },
          ' *',
          ' * This program is free software; you can redistribute it and/or modify',
          ' * it under the terms of the GNU Affero General Public License as',
          ' * published by the Free Software Foundation; either version 3 of the',
          ' * License, or (at your option) any later version.',
          ' *',
          ' * This program is distributed in the hope that it will be useful,',
          ' * but WITHOUT ANY WARRANTY; without even the implied warranty of',
          ' * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the',
          ' * GNU Affero General Public License for more details.',
          ' *',
          ' * You should have received a copy of the GNU Affero General Public',
          ' * License along with this program.  If not, see',
          ' * <https://www.gnu.org/licenses/>.',
          ' ',
        ],
      ],
      'no-constant-condition': [
        'error',
        {
          checkLoops: false,
        },
      ],

      'simple-import-sort/exports': 'warn',
      'simple-import-sort/imports': 'warn',
      'unused-imports/no-unused-imports': 'error',

      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    files: ['**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]