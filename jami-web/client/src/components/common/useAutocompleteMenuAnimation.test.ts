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
import { describe, expect, it } from 'vitest'

import { getAutocompleteMenuTransformOrigin } from './useAutocompleteMenuAnimation.js'

describe('getAutocompleteMenuTransformOrigin', () => {
  it('uses the bottom edge when Popper places the menu above its input', () => {
    expect(getAutocompleteMenuTransformOrigin('top-start')).toBe('bottom')
  })

  it('uses the top edge for menus placed below their input', () => {
    expect(getAutocompleteMenuTransformOrigin('bottom-start')).toBe('top')
  })
})
