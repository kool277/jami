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
import { darken, lighten } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import { getPeerBubbleColor, getReplyBubbleColor, getReplyRing } from './messagecolor.js'

describe('getReplyRing', () => {
  const light = buildDefaultTheme('light', 'ltr')
  const dark = buildDefaultTheme('dark', 'ltr')

  it('keeps the same width in both modes so switching theme cannot resize the bubble', () => {
    const width = (ring: string) => ring.split(' ')[0]
    expect(width(getReplyRing(light))).toBe(width(getReplyRing(dark)))
  })

  it('draws the ring in the surface behind the bubble', () => {
    expect(getReplyRing(light)).toContain(light.palette.background.default)
    expect(getReplyRing(dark)).toContain(dark.palette.background.default)
  })
})

describe('message bubble colours', () => {
  const light = buildDefaultTheme('light', 'ltr')
  const dark = buildDefaultTheme('dark', 'ltr')

  it('derives peer bubbles from the shared surface in light mode', () => {
    expect(getPeerBubbleColor(light)).toBe(darken(light.palette.background.paper, 0.04))
    expect(getReplyBubbleColor(light)).toBe(darken(light.palette.background.paper, 0.07))
  })

  it('derives peer bubbles from the shared surface in dark mode', () => {
    expect(getPeerBubbleColor(dark)).toBe(lighten(dark.palette.background.paper, 0.36))
    expect(getReplyBubbleColor(dark)).toBe(lighten(dark.palette.background.paper, 0.17))
  })

  it('keeps a quoted reply distinct from its enclosing peer bubble', () => {
    for (const theme of [light, dark]) {
      expect(getReplyBubbleColor(theme)).not.toBe(getPeerBubbleColor(theme))
    }
  })
})
