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

import { Box, List, Typography } from '@mui/material'
import { IConversationSummary } from '@savoirfairelinux/jami-web-common'
import { useMemo } from 'react'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useConversationDisplayNameShort } from '../hooks/useConversationDisplayName.js'
import { useConversationsSummariesQuery, useMembersQuery } from '../services/conversationQueries.js'
import ConversationAvatar, { GroupConversationAvatar } from './ConversationAvatar.js'
import { CustomListItemButton } from './CustomListItemButton.js'

interface SelectConversationListProps {
  selectedConversationIds: string[]
  onSelectConversation: (conversationId: string) => void
}

export const SelectConversationList = ({
  selectedConversationIds,
  onSelectConversation,
}: SelectConversationListProps) => {
  const conversationsSummariesQuery = useConversationsSummariesQuery()
  const { conversationId } = useConversationContext()

  const conversationsSummaries = useMemo(
    () => (conversationsSummariesQuery.data || []).filter((conversation) => conversation.id !== conversationId),
    [conversationsSummariesQuery.data, conversationId],
  )

  const sortedConversations = useMemo(() => {
    if (conversationsSummaries.length === 1) {
      return conversationsSummaries
    }
    if (conversationsSummaries.some((conversationSummary) => conversationSummary === null)) {
      return conversationsSummaries
    }
    return [...conversationsSummaries].sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0))
  }, [conversationsSummaries])

  return (
    <Box sx={{ overflowY: 'scroll', height: '100%' }}>
      <List
        sx={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {sortedConversations?.map(
          (conversationSummary) =>
            conversationSummary !== null && (
              <SelectConversationListItem
                key={conversationSummary.id}
                conversationSummary={conversationSummary}
                isSelected={selectedConversationIds.includes(conversationSummary.id)}
                onSelectConversation={onSelectConversation}
              />
            ),
        )}
      </List>
    </Box>
  )
}

type SelectConversationListItemProps = {
  conversationSummary: IConversationSummary
  isSelected: boolean
  onSelectConversation: (conversationId: string) => void
}

const SelectConversationListItem = ({
  conversationSummary,
  onSelectConversation,
  isSelected,
}: SelectConversationListItemProps) => {
  const { account } = useAuthContext()
  const members = useMembersQuery(conversationSummary.id)
  const memberArray = members.data

  const filteredMembers = useMemo(() => {
    return memberArray?.filter((member) => member.contact.uri !== account.getUri()) || []
  }, [memberArray, account])

  const onClick = () => {
    onSelectConversation(conversationSummary.id)
  }

  const conversationName = useConversationDisplayNameShort(
    account,
    conversationSummary.title,
    conversationSummary.membersNames,
  )

  return (
    <Box>
      <CustomListItemButton
        selected={isSelected}
        onClick={onClick}
        icon={
          Number(conversationSummary.mode) !== 0 ? (
            <GroupConversationAvatar
              displayName={conversationName}
              members={memberArray || []}
              src={conversationSummary.avatar}
            />
          ) : (
            <ConversationAvatar
              contactUri={
                Number(conversationSummary.mode) === 0 && filteredMembers.length > 0
                  ? filteredMembers[0].contact.uri
                  : ''
              }
              displayName={conversationName}
              src={conversationSummary.avatar}
            />
          )
        }
        primaryText={<Typography variant="body1">{conversationName}</Typography>}
      />
    </Box>
  )
}
