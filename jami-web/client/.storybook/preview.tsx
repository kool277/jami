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
import '../src/material-symbols.scss'
import '../src/themes/fonts.js'

import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import CssBaseline from '@mui/material/CssBaseline'
import { type Direction, type PaletteMode, ThemeProvider } from '@mui/material/styles'
import rtlPlugin from '@mui/stylis-plugin-rtl'
import type { Decorator, Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'
import { prefixer } from 'stylis'

import { buildDefaultTheme } from '../src/themes/Default.js'
import { WithChildren } from '../src/utils/utils.js'
import i18n from './i18n.js'

const ltrCache = createCache({ key: 'mui', stylisPlugins: [prefixer] })
const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] })

const ThemedStory = ({ mode, direction, children }: { mode: PaletteMode; direction: Direction } & WithChildren) => {
  useEffect(() => {
    // MUI reads the direction from the theme, but logical CSS and text selection follow the document.
    document.documentElement.dir = direction
  }, [direction])

  return (
    <CacheProvider value={direction === 'rtl' ? rtlCache : ltrCache}>
      <ThemeProvider theme={buildDefaultTheme(mode, direction)}>
        <I18nextProvider i18n={i18n}>
          <CssBaseline />
          {children}
        </I18nextProvider>
      </ThemeProvider>
    </CacheProvider>
  )
}

const withJamiTheme: Decorator = (Story, context) => (
  <ThemedStory mode={context.globals.mode as PaletteMode} direction={context.globals.direction as Direction}>
    <Story />
  </ThemedStory>
)

const preview: Preview = {
  decorators: [withJamiTheme],
  initialGlobals: {
    mode: 'light',
    direction: 'ltr',
  },
  globalTypes: {
    mode: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    direction: {
      description: 'Writing direction',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'Left to right' },
          { value: 'rtl', title: 'Right to left' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: 'centered',
    controls: { expanded: true },
  },
}

export default preview
