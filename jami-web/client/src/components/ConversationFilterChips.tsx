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
import { Chip, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { type ConversationFilter } from '../utils/conversationFilters.js'

const filters: ConversationFilter[] = ['all', 'unread', 'groups']

export interface ConversationFilterChipsProps {
  value: ConversationFilter
  unreadConversationCount: number
  onChange: (filter: ConversationFilter) => void
}

export default function ConversationFilterChips({
  value,
  unreadConversationCount,
  onChange,
}: ConversationFilterChipsProps) {
  const { t } = useTranslation()

  return (
    <Stack direction="row" sx={{ gap: 1 }} role="group" aria-label={t('conversation_filters')}>
      {filters.map((filter) => {
        const selected = value === filter
        const label =
          filter === 'unread' && unreadConversationCount > 0 ? `${t(filter)} (${unreadConversationCount})` : t(filter)
        return (
          <Chip
            key={filter}
            label={label}
            clickable
            color={selected ? 'primary' : 'default'}
            variant={selected ? 'filled' : 'outlined'}
            aria-pressed={selected}
            onClick={() => onChange(filter)}
          />
        )
      })}
    </Stack>
  )
}
