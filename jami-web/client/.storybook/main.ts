/*
 * Copyright (C) 2026 Savoir-faire Linux Inc.
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
import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/react-vite'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    // The app's dev server gate resolves every HTML request against the API, which Storybook runs without.
    plugins: viteConfig.plugins?.filter(
      (plugin) => !(plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name === 'admin-setup-gate'),
    ),
    server: {
      ...viteConfig.server,
      fs: {
        ...viteConfig.server?.fs,
        // Stories render with the translations the server ships, which live outside the client workspace.
        allow: [repositoryRoot],
      },
    },
  }),
}

export default config
