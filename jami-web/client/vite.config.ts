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
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { AdminWizardState, getAdminSetupRedirect } from '@savoirfairelinux/jami-web-common'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

function getGitCommitHash(): string {
  if (process.env.GIT_COMMIT_HASH) {
    return process.env.GIT_COMMIT_HASH
  }

  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // Docker build contexts intentionally exclude .git, so development and test servers still need a safe value.
    return 'unknown'
  }
}

function getJamiCoreVersion() {
  if (process.env.JAMI_CORE_VERSION) {
    return process.env.JAMI_CORE_VERSION
  }

  try {
    const jamiCoreEntrypoint = fileURLToPath(import.meta.resolve('@savoirfairelinux/jami-core'))
    const jamiCorePackage = JSON.parse(
      readFileSync(join(dirname(jamiCoreEntrypoint), '..', 'package.json'), 'utf8'),
    ) as {
      version?: unknown
    }

    return typeof jamiCorePackage.version === 'string' ? jamiCorePackage.version : 'unknown'
  } catch {
    // The lightweight Playwright image does not install the daemon core package.
    return 'unknown'
  }
}

const gitCommitHash = getGitCommitHash()
const jamiCoreVersion = getJamiCoreVersion()

const adminSetupGatePlugin = (apiOrigin: string, desktopMode: boolean): Plugin => ({
  name: 'admin-setup-gate',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (desktopMode || req.method !== 'GET' || !req.headers.accept?.includes('text/html')) {
        next()
        return
      }

      try {
        const response = await fetch(new URL('/api/admin/admin-wizard-state', apiOrigin))
        if (!response.ok) {
          throw new Error(`Admin wizard state request failed with status ${response.status}`)
        }

        const data = (await response.json()) as { lastWizardState?: AdminWizardState }
        const wizardState = data.lastWizardState ?? AdminWizardState.account
        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
        const redirectPath = getAdminSetupRedirect(pathname, wizardState)
        if (redirectPath) {
          res.statusCode = 302
          res.setHeader('Location', redirectPath)
          res.end()
          return
        }

        next()
      } catch (error) {
        next(error)
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const debugDesktopMode = mode !== 'production' && process.env.JAMI_DEBUG_DESKTOP_MODE === 'true'

  return {
    optimizeDeps: {
      include: ['@emotion/react', '@emotion/styled', '@mui/material/Tooltip', 'react-draggable'],
      rolldownOptions: {
        transform: {
          define: {
            'process.env.DRAGGABLE_DEBUG': 'false',
          },
        },
      },
    },
    plugins: [adminSetupGatePlugin(env.VITE_API_URL, debugDesktopMode), react(), svgr()],
    server: {
      host: process.env.VITE_HOST ?? env.VITE_HOST ?? '127.0.0.1',
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      port: 8080,
    },
    build: {
      outDir: '../server/client/dist',
      emptyOutDir: true,
      target: ['chrome117', 'edge121', 'firefox121', 'safari17'],
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'admin',
                test: /client[\\/]src[\\/]admin[\\/]/,
                priority: 20,
                includeDependenciesRecursively: false,
              },
              {
                name: 'settings',
                // Route constants are needed by the root router and must not pull
                // the settings implementation into the initial bundle.
                test: /client[\\/]src[\\/]settings[\\/](?!routes\.)/,
                priority: 20,
                includeDependenciesRecursively: false,
              },
              {
                // Recursively including dependencies (the rolldown default) keeps modules
                // shared with app chunks out of this vendor bucket, which avoids the
                // circular chunk imports that caused "u is not a function" at runtime.
                name: 'react-vendor',
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              },
              {
                name: 'ui-vendor',
                test: /node_modules[\\/](@mui|@emotion|@popperjs|react-transition-group)[\\/]/,
              },
            ],
          },
        },
      },
    },
    define: {
      'process.env.DRAGGABLE_DEBUG': 'false',
      __GIT_COMMIT_HASH__: JSON.stringify(gitCommitHash),
      __JAMI_CORE_VERSION__: JSON.stringify(jamiCoreVersion),
      global: {},
      __JAMI_DEBUG_DESKTOP_MODE__: JSON.stringify(debugDesktopMode),
    },
  }
})
