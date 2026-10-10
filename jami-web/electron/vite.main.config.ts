/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
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

/**
 * Vite configuration for the Electron main process.
 *
 * The @electron-forge/plugin-vite plugin merges its own opinionated
 * defaults on top of this config (CJS output format, Node externals,
 * electron external, outDir → .vite/build/).  Only project-specific
 * overrides belong here.
 */
import { defineConfig } from 'vite'

// The Forge Vite plugin builds the main process as CJS by default.
// Override to ESM so it matches the "type": "module" in package.json.
export default defineConfig({
  build: {
    lib: {
      // Must match the `entry` declared in forge.config.js.
      entry: 'electron/main.ts',
      formats: ['es'],
      fileName: () => '[name].js',
    },
  },
  resolve: {
    browserField: false,
    mainFields: ['module', 'jsnext:main', 'jsnext'],
    conditions: ['node'],
  },
})
