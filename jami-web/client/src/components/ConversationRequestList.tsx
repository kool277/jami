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

import { List, Typography } from '@mui/material'
import { IConversationRequest } from '@savoirfairelinux/jami-web-common'
import { useNavigate, useParams } from 'react-router-dom'

import { useConversationDisplayNameShort } from '../hooks/useConversationDisplayName.js'
import { useConversationRequestsQuery } from '../services/conversationQueries.js'
import ConversationAvatar from './ConversationAvatar.js'
import { CustomListItemButton } from './CustomListItemButton.js'
import EllipsisMiddle from './EllipsisMiddle.js'

export const ConversationRequestList = () => {
  const conversationRequestsQuery = useConversationRequestsQuery()
  const conversationRequests = conversationRequestsQuery.data

  return (
    <List>
      {conversationRequests?.map((conversationRequest) => (
        <ConversationRequestListItem
          key={conversationRequest.conversationId}
          conversationRequest={conversationRequest}
        />
      ))}
    </List>
  )
}

type ConversationRequestListItemProps = {
  conversationRequest: IConversationRequest
}

const ConversationRequestListItem = ({ conversationRequest }: ConversationRequestListItemProps) => {
  const { conversationId: selectedConversationId } = useParams()
  const navigate = useNavigate()
  const infos = conversationRequest.infos
  const conversationName = useConversationDisplayNameShort(null, infos.title, conversationRequest.membersNames)

  return (
    <CustomListItemButton
      onClick={() => navigate(`/invites/${conversationRequest.conversationId}`)}
      selected={conversationRequest.conversationId === selectedConversationId}
      icon={<ConversationAvatar displayName={conversationName} src={infos.avatar} contactUri="" />}
      primaryText={
        <Typography component="div" variant="body1" sx={{ minWidth: 0 }}>
          <EllipsisMiddle text={conversationName} />
        </Typography>
      }
    />
  )
}
