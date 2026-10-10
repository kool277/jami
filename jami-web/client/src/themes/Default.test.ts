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
import { type PaletteMode } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'

import { buildDefaultTheme } from './Default.js'

const modes: PaletteMode[] = ['light', 'dark']

/**
 * The slots the application reads directly off the theme. A slot misspelt in
 * one mode only resolves to undefined there, which reaches the browser as a
 * silently dropped declaration rather than an error.
 */
const customSlots = ['EmojiPicker', 'Panel'] as const

function leaves(value: unknown, path: string): [string, unknown][] {
  if (value === null || typeof value !== 'object') {
    return [[path, value]]
  }
  return Object.entries(value).flatMap(([key, child]) => leaves(child, `${path}.${key}`))
}

describe('default theme', () => {
  for (const mode of modes) {
    it(`defines every custom slot in ${mode} mode`, () => {
      const theme = buildDefaultTheme(mode, 'ltr') as unknown as Record<string, unknown>

      const undefinedEntries = customSlots
        .flatMap((slot) => leaves(theme[slot], slot))
        .filter(([, value]) => value === undefined)
        .map(([path]) => path)

      expect(undefinedEntries).toEqual([])
    })
  }

  for (const mode of modes) {
    it(`draws the contained and outlined buttons from the ${mode} primary ramp`, () => {
      const theme = buildDefaultTheme(mode, 'ltr')
      const overrides = theme.components?.MuiButton?.styleOverrides as
        Record<string, Record<string, unknown>> | undefined

      expect(overrides?.contained?.background).toBe(theme.palette.primary.dark)
      expect(overrides?.outlined?.color).toBe(theme.palette.primary.dark)
      expect(overrides?.outlined?.borderColor).toBe(theme.palette.primary.dark)
    })
  }

  for (const mode of modes) {
    it(`exposes a callable 8px spacing scale in ${mode} mode`, () => {
      const theme = buildDefaultTheme(mode, 'ltr')

      // `createTheme(base, overrides)` deep-merges the overrides over an already built theme, so a
      // scalar `spacing` there replaces the function MUI derived from it and every styled component
      // that calls `theme.spacing(...)` throws at render time.
      expect(typeof theme.spacing).toBe('function')
      expect(theme.spacing(1)).toBe('8px')
      expect(theme.spacing(2)).toBe('16px')
    })
  }

  it('keeps the two modes structurally identical', () => {
    const light = buildDefaultTheme('light', 'ltr') as unknown as Record<string, unknown>
    const dark = buildDefaultTheme('dark', 'ltr') as unknown as Record<string, unknown>

    for (const slot of customSlots) {
      const lightKeys = leaves(light[slot], slot).map(([path]) => path)
      const darkKeys = leaves(dark[slot], slot).map(([path]) => path)
      expect({ slot, keys: lightKeys }).toEqual({ slot, keys: darkKeys })
    }
  })
})
