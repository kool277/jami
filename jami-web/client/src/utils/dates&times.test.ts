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
import dayjs from 'dayjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { formatConversationDate, formatTime } from './dates&times.js'

const i18n = { language: 'en' } as never

describe('formatConversationDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 3, 12))
  })

  afterEach(() => vi.useRealTimers())

  it('uses a time for conversations updated today', () => {
    const timestamp = dayjs(new Date(2026, 7, 3, 9, 15))

    expect(formatConversationDate(timestamp, i18n)).toBe(formatTime(timestamp, i18n))
  })

  it('uses a relative label for yesterday', () => {
    expect(formatConversationDate(dayjs(new Date(2026, 7, 2, 12)), i18n)).toBe('yesterday')
  })

  it('uses the weekday for the previous six days', () => {
    expect(formatConversationDate(dayjs(new Date(2026, 6, 29, 12)), i18n)).toBe('Wednesday')
  })

  it('omits the year for older dates this year', () => {
    expect(formatConversationDate(dayjs(new Date(2026, 6, 24, 12)), i18n)).toBe('Jul 24')
  })

  it('includes the year for dates from prior years', () => {
    expect(formatConversationDate(dayjs(new Date(2025, 11, 31, 12)), i18n)).toBe('Dec 31, 2025')
  })
})
