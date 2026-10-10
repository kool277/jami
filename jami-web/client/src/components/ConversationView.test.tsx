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

import { getConversationHeaderIdentity, getConversationHeaderSecondary } from './ConversationView.js'

const hash = '260d9aaee80c84ffda86bdc579a0be8d07a70b65'

describe('getConversationHeaderIdentity', () => {
  it('shows a display name before the registered name', () => {
    expect(getConversationHeaderIdentity('Ada Lovelace', 'ada', hash)).toEqual({
      primary: 'Ada Lovelace',
      secondary: 'ada',
    })
  })

  it('uses the hash when no registered name is available', () => {
    expect(getConversationHeaderIdentity('Ada Lovelace', undefined, hash)).toEqual({
      primary: 'Ada Lovelace',
      secondary: hash,
    })
  })

  describe('getConversationHeaderSecondary', () => {
    it('shows a non-empty group description instead of an identity', () => {
      expect(getConversationHeaderSecondary(true, 'Project planning', 'ignored')).toBe('Project planning')
    })

    it('hides an empty group description', () => {
      expect(getConversationHeaderSecondary(true, '  ', 'ignored')).toBeUndefined()
    })

    it('keeps the contact identity for private conversations', () => {
      expect(getConversationHeaderSecondary(false, 'Ignored description', 'ada')).toBe('ada')
    })
  })

  it('shows a registered name only once when it is the sole identity', () => {
    expect(getConversationHeaderIdentity('ada', 'ada', hash)).toEqual({
      primary: 'ada',
      primaryIsJamiId: true,
    })
  })

  it('shows a hash only once when it is the sole identity', () => {
    expect(getConversationHeaderIdentity(hash, undefined, hash)).toEqual({
      primary: hash,
      primaryIsJamiId: true,
    })
  })
})
