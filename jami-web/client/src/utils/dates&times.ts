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
import dayjs, { Dayjs } from 'dayjs'
import { Duration } from 'dayjs/plugin/duration.js'
import { i18n } from 'i18next'

export const formatTime = (time: Dayjs, i18n: i18n) => {
  return dayjs(time).locale(i18n.language).format('LT')
}

export const formatRelativeDate = (time: Dayjs, i18n: i18n) => {
  let languageTag = i18n.language
  languageTag = languageTag.replace(/_/g, '-')

  if (time.isToday()) {
    return new Intl.RelativeTimeFormat(languageTag, { numeric: 'auto' }).format(0, 'day')
  } else if (time.isYesterday()) {
    return new Intl.RelativeTimeFormat(languageTag, { numeric: 'auto' }).format(-1, 'day')
  } else {
    return dayjs(time).locale(languageTag).format('L')
  }
}

export const formatConversationDate = (time: Dayjs, i18n: i18n) => {
  const languageTag = i18n.language.replace(/_/g, '-')
  const today = dayjs()
  const daysDiff = today.startOf('day').diff(time.startOf('day'), 'day')

  if (daysDiff === 0) {
    return formatTime(time, i18n)
  }
  if (daysDiff === 1) {
    return new Intl.RelativeTimeFormat(languageTag, { numeric: 'auto' }).format(-1, 'day')
  }

  if (daysDiff > 0 && daysDiff < 7) {
    return new Intl.DateTimeFormat(languageTag, { weekday: 'long' }).format(time.toDate())
  }

  return new Intl.DateTimeFormat(languageTag, {
    month: 'short',
    day: 'numeric',
    ...(time.year() === today.year() ? {} : { year: 'numeric' }),
  }).format(time.toDate())
}

export const formatCallDuration = (duration: Duration) => {
  const minutes = Math.floor(duration.asMinutes()).toString().padStart(2, '0')
  const seconds = duration.format('ss')
  return `${minutes}:${seconds}`
}
