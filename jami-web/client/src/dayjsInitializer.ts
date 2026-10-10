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
import 'dayjs/locale/en'
import 'dayjs/locale/fr'

import dayjs from 'dayjs'
import dayOfYear from 'dayjs/plugin/dayOfYear.js'
import duration from 'dayjs/plugin/duration.js'
import isBetween from 'dayjs/plugin/isBetween.js'
import isToday from 'dayjs/plugin/isToday.js'
import isYesterday from 'dayjs/plugin/isYesterday.js'
import localizedFormat from 'dayjs/plugin/localizedFormat.js'

dayjs.extend(dayOfYear)
dayjs.extend(duration)
dayjs.extend(isBetween)
dayjs.extend(isToday)
dayjs.extend(isYesterday)
dayjs.extend(localizedFormat)
