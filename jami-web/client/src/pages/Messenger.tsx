/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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
import { Stack } from '@mui/material'
import { type ChangeEvent, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { ISLAND_PADDING } from '../components/common/Island.js'
import ContactSearchBar from '../components/ContactSearchBar.js'
import ConversationFilterChips from '../components/ConversationFilterChips.js'
import ConversationList from '../components/ConversationList.js'
import AppShell from '../components/shell/AppShell.js'
import WelcomePage from '../components/WelcomePage.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useConversationsSummariesQuery } from '../services/conversationQueries.js'
import { type ConversationFilter, isConversationUnread } from '../utils/conversationFilters.js'

type PendingConversationState = {
  searchFilter?: string
}

export default function Messenger() {
  const { key, pathname, state } = useLocation()
  const pendingContactUri = /^\/conversation\/new\/([^/]+)$/.exec(pathname)?.[1]
  const selectedSearchFilter =
    state &&
    typeof state === 'object' &&
    'searchFilter' in state &&
    typeof state.searchFilter === 'string' &&
    state.searchFilter
      ? (state as PendingConversationState).searchFilter
      : pendingContactUri

  return <MessengerContent key={pendingContactUri ? key : undefined} initialSearchFilter={selectedSearchFilter || ''} />
}

type MessengerContentProps = {
  initialSearchFilter: string
}

function MessengerContent({ initialSearchFilter }: MessengerContentProps) {
  const { t } = useTranslation()
  const conversationsSummariesQuery = useConversationsSummariesQuery()
  useDocumentTitle(t('conversations'))
  const [searchFilter, setSearchFilter] = useState(initialSearchFilter)
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all')

  const unreadConversationCount = (conversationsSummariesQuery.data || []).filter((conversation) =>
    isConversationUnread(conversation),
  ).length
  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchFilter(event.target.value)
  }, [])

  return (
    <AppShell
      listRoute="/conversation"
      listPaneLabel={t('conversations')}
      listSearch={
        <Stack sx={{ gap: 1, pr: ISLAND_PADDING, pb: '4px' }}>
          <ContactSearchBar
            placeholder={t('find_users_and_conversations')}
            value={searchFilter}
            handleChange={handleSearchChange}
          />
          <ConversationFilterChips
            value={conversationFilter}
            unreadConversationCount={unreadConversationCount}
            onChange={setConversationFilter}
          />
        </Stack>
      }
      listPane={<ConversationList searchFilter={searchFilter} conversationFilter={conversationFilter} />}
      placeholder={<WelcomePage />}
      immersiveDetail
    />
  )
}
