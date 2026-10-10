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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ContactIdentity, isJamiHash } from './ContactIdentity.js'

const hash = '260d9aaee80c84ffda86bdc579a0be8d07a70b65'

describe('ContactIdentity', () => {
  it('prioritizes a display name and shows the registered name separately', () => {
    render(<ContactIdentity uri={hash} displayName="Ada" registeredName="ada" />)

    expect(screen.getByText('Ada')).toBeVisible()
    expect(screen.getByText('ada')).toBeVisible()
  })

  it('uses the Jami identifier when no names are available', () => {
    render(<ContactIdentity uri={hash} />)

    expect(screen.getByText(hash)).toBeVisible()
  })

  it('recognizes only 40-character hexadecimal Jami identifiers as hashes', () => {
    expect(isJamiHash(hash)).toBe(true)
    expect(isJamiHash('ada')).toBe(false)
  })
})
