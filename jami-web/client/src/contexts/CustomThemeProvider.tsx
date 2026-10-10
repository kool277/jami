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
import createCache from '@emotion/cache'
import { CacheProvider } from '@emotion/react'
import { CssBaseline, GlobalStyles, PaletteMode } from '@mui/material'
import { type Direction, ThemeProvider } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import rtlPlugin from '@mui/stylis-plugin-rtl'
import { createContext, lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { prefixer } from 'stylis'

import { resetLanguageToSystem } from '../i18n.js'
import { buildDefaultTheme } from '../themes/Default.js'
import { WithChildren } from '../utils/utils.js'

const ltrCache = createCache({ key: 'mui', stylisPlugins: [prefixer] })
const rtlCache = createCache({ key: 'muirtl', stylisPlugins: [prefixer, rtlPlugin] })
const DebugToolsDialog = import.meta.env.DEV ? lazy(() => import('../components/DebugToolsDialog.js')) : null

interface ICustomThemeContext {
  mode: PaletteMode
  toggleMode: () => void
  animationsEnabled: boolean
  toggleAnimations: () => void
}

export const CustomThemeContext = createContext<ICustomThemeContext>(undefined!)

export default ({ children }: WithChildren) => {
  const { i18n } = useTranslation()
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [debugDirection, setDebugDirection] = useState<Direction | null>(null)
  const showDebugTools = import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug-tools') === '1'
  const direction = debugDirection ?? i18n.dir(i18n.language)
  const [selectedMode, setSelectedMode] = useState<PaletteMode | undefined>(() => {
    const themeModeInStorage = localStorage.getItem('themeMode')
    if (typeof themeModeInStorage === 'string') {
      return JSON.parse(themeModeInStorage) === 'dark' ? 'dark' : 'light'
    }
    return undefined
  })
  const mode = selectedMode ?? (prefersDarkMode ? 'dark' : 'light')
  const [selectedAnimationsEnabled, setSelectedAnimationsEnabled] = useState<boolean | undefined>(() => {
    const animationsEnabledInStorage = localStorage.getItem('animationsEnabled')
    return animationsEnabledInStorage === null ? undefined : animationsEnabledInStorage === 'true'
  })
  const animationsEnabled = selectedAnimationsEnabled ?? !prefersReducedMotion

  const toggleMode = useCallback(() => {
    setSelectedMode((selectedMode) => {
      const mode = selectedMode ?? (prefersDarkMode ? 'dark' : 'light')
      const newMode = mode === 'light' ? 'dark' : 'light'
      localStorage.setItem('themeMode', JSON.stringify(newMode))
      return newMode
    })
  }, [prefersDarkMode])
  const toggleAnimations = useCallback(() => {
    setSelectedAnimationsEnabled((current) => {
      const next = !(current ?? !prefersReducedMotion)
      localStorage.setItem('animationsEnabled', String(next))
      return next
    })
  }, [prefersReducedMotion])

  const resetDebugTools = useCallback(async () => {
    setDebugDirection(null)
    localStorage.removeItem('themeMode')
    setSelectedMode(undefined)
    await resetLanguageToSystem()
  }, [])

  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = i18n.language.replace('_', '-')
  }, [direction, i18n.language])

  const theme = useMemo(() => buildDefaultTheme(mode, direction), [direction, mode])
  const debugTheme = useMemo(() => buildDefaultTheme(mode, 'ltr'), [mode])

  const value = useMemo(
    () => ({
      mode,
      toggleMode,
      animationsEnabled,
      toggleAnimations,
    }),
    [animationsEnabled, mode, toggleAnimations, toggleMode],
  )

  return (
    <CustomThemeContext value={value}>
      <CacheProvider value={direction === 'rtl' ? rtlCache : ltrCache}>
        <ThemeProvider theme={theme}>
          <CssBaseline enableColorScheme />
          {!animationsEnabled && (
            <GlobalStyles
              styles={{
                '*, *::before, *::after': {
                  animationDuration: '0s !important',
                  animationIterationCount: '1 !important',
                  transitionDuration: '0s !important',
                  scrollBehavior: 'auto !important',
                },
              }}
            />
          )}
          {children}
          {showDebugTools && DebugToolsDialog && (
            <Suspense fallback={null}>
              <CacheProvider value={ltrCache}>
                <ThemeProvider theme={debugTheme}>
                  <DebugToolsDialog
                    direction={direction}
                    mode={mode}
                    onDirectionChange={setDebugDirection}
                    onModeToggle={toggleMode}
                    onReset={resetDebugTools}
                  />
                </ThemeProvider>
              </CacheProvider>
            </Suspense>
          )}
        </ThemeProvider>
      </CacheProvider>
    </CustomThemeContext>
  )
}
