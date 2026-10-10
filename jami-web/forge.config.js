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
import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { VitePlugin } from '@electron-forge/plugin-vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = __dirname

/** @type {import('@electron-forge/shared-types').ForgeConfig} */
export default {
  packagerConfig: {
    // Keep the package unarchived so the Express server (a forked
    // utility process relying on ESM and native Node addons) can read
    // its own files directly from disk at runtime.
    asar: false,
    // Disable electron-packager's built-in prune step: it only looks at
    // the root package.json dependencies and would strip all server and
    // common workspace packages.  We build our own production-only
    // node_modules in the packageAfterCopy hook below.
    prune: false,
    name: 'Jami',
    appBundleId: 'net.jami.web',
    icon: 'electron/icons/jami',
    // Use a function-based ignore so the Forge Vite plugin's auto-ignore
    // is bypassed.  We keep .vite/ and package.json; node_modules is
    // rebuilt from scratch by the hook so we exclude the source copy.
    ignore: (filePath) => {
      // electron-packager passes an empty string for the root itself — keep it
      if (!filePath) return false

      // Compiled Electron main process and preload (from Vite plugin)
      if (filePath.startsWith('/.vite')) return false

      // Electron needs package.json to find the main entry point
      if (filePath === '/package.json') return false

      // Skip node_modules here — the hook installs a clean production set
      if (filePath.startsWith('/node_modules')) return true

      // server/ and client/ are added by the packageAfterCopy hook below
      return true
    },
  },

  rebuildConfig: {},

  makers: [
    // macOS: DMG installer
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
      },
    },
    // Windows: Squirrel installer
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    // Linux: .deb package
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    // Linux: .rpm package
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],

  plugins: [
    new VitePlugin({
      // Build the Electron main process and preload script with Vite.
      // Output goes to .vite/build/ (required by the Forge Vite plugin).
      build: [
        {
          entry: 'electron/main.ts',
          config: 'electron/vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'electron/preload.ts',
          config: 'electron/vite.preload.config.ts',
          target: 'preload',
        },
      ],
      // No Vite-managed renderer: the Express server serves the React app.
      renderer: [],
    }),
  ],

  hooks: {
    /**
     * After the Forge Vite plugin copies the minimal app skeleton (.vite/build/
     * and package.json) into buildPath, we:
     *
     *  1. Build a clean production node_modules that contains only the runtime
     *     dependencies of the server and common workspace packages (and their
     *     transitive deps), resolved from the monorepo root node_modules.
     *     This avoids copying the ~900 devDep packages that would otherwise
     *     bloat the package.
     *
     *  2. Copy the compiled Express server distribution.
     *
     *  3. Copy the pre-built React client SPA.
     *
     * Path layout inside buildPath (= Resources/app/ in the final .app):
     *   .vite/build/main.js     — Electron main process
     *   .vite/build/preload.js  — contextBridge preload
     *   node_modules/           — production runtime deps only
     *   server/dist/index.js    — Express server (forked as utilityProcess)
     *   client/dist/index.html  — React SPA served by Express
     */
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const copy = (src, dest) => {
        if (!existsSync(src)) return
        mkdirSync(path.dirname(dest), { recursive: true })
        cpSync(src, dest, { recursive: true })
      }
      const copyFile = (src, dest) => {
        if (!existsSync(src)) return
        mkdirSync(path.dirname(dest), { recursive: true })
        copyFileSync(src, dest)
      }

      // ── 1. Production node_modules ─────────────────────────────────────
      // Use npm ls to get the complete transitive production dep list for
      // the root, server and common workspaces, then copy each package
      // from the monorepo root node_modules into the packaged app.
      const nmSrc = path.join(PROJECT_ROOT, 'node_modules')
      const nmDest = path.join(buildPath, 'node_modules')
      mkdirSync(nmDest, { recursive: true })

      const lsOutput = execSync(
        'npm ls --workspace=@savoirfairelinux/jami-web --workspace=@savoirfairelinux/jami-web-common --all --omit=dev --parseable 2>/dev/null || true',
        { cwd: PROJECT_ROOT, encoding: 'utf8' },
      )
      const prodPkgs = new Set()
      for (const line of lsOutput.split('\n')) {
        const idx = line.indexOf('node_modules/')
        if (idx < 0) continue
        const rel = line.slice(idx + 'node_modules/'.length).trim()
        if (rel) prodPkgs.add(rel)
      }

      for (const pkg of prodPkgs) {
        const src = path.join(nmSrc, pkg)
        if (!existsSync(src)) continue
        const dest = path.join(nmDest, pkg)
        mkdirSync(path.dirname(dest), { recursive: true })
        cpSync(src, dest, { recursive: true })
      }

      // ── 2. Express server distribution ────────────────────────────────
      const serverSrc = path.join(PROJECT_ROOT, 'server')
      const serverDest = path.join(buildPath, 'server')

      copy(path.join(serverSrc, 'dist'), path.join(serverDest, 'dist'))
      copyFile(path.join(serverSrc, 'package.json'), path.join(serverDest, 'package.json'))

      for (const file of ['available_languages.json', 'openid-providers.json', 'openapi.yaml']) {
        copyFile(path.join(serverSrc, file), path.join(serverDest, file))
      }
      copy(path.join(serverSrc, 'locale'), path.join(serverDest, 'locale'))

      // ── 3. Pre-built React SPA ─────────────────────────────────────────
      copy(path.join(PROJECT_ROOT, 'server', 'client', 'dist'), path.join(buildPath, 'client', 'dist'))
    },
  },
}
