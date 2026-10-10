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

export const MESSAGES_NUMBER_TO_LOAD = 16

/**
 * Upper bound on the unread messages counted per conversation. The daemon
 * exposes no "count interactions" binding, so the count requires loading
 * messages; without a bound, rendering the conversation list would pull the
 * entire history of every conversation. Counts at the bound mean "or more".
 */
export const MAX_UNREAD_MESSAGE_COUNT = 99

export const MIN_PASSWORD_LENGTH = 8

export const urlRegex = /^(https?:\/\/)?(localhost|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?::\d{1,5})?(\/[^\s]*)?$/
