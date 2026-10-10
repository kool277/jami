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
import {
  ComposingStatus,
  ConversationInfos,
  ConversationMemberEvent,
  ConversationView,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'

import LoadingPage from '../components/Loading.js'
import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { useConversationDisplayName } from '../hooks/useConversationDisplayName.js'
import { useUrlParams } from '../hooks/useUrlParams.js'
import { Contact } from '../models/contact.js'
import { ConversationMember } from '../models/conversation-member.js'
import { ConversationRouteParams } from '../router.js'
import { useConversationInfosQuery, useMembersQuery } from '../services/conversationQueries.js'
import { WithChildren } from '../utils/utils.js'
import { useAuthContext } from './AuthProvider.js'
import { useWebSocketContext } from './WebSocketProvider.js'

interface IConversationContext {
  conversationId: string
  conversationDisplayName: string
  conversationInfos: ConversationInfos
  members: ConversationMember[]
  composingMembers: ConversationMember[]
  /** True while the conversation is only local: the peer has not been invited yet. */
  isPending: boolean
  /** The peer to invite, set only while the conversation is pending. */
  pendingContact?: Contact
}

const optionalConversationContext = createOptionalContext<IConversationContext>('ConversationContext')
export const ConversationContext = optionalConversationContext.Context
export const useConversationContext = optionalConversationContext.useOptionalContext

export default ({ children }: WithChildren) => {
  const {
    urlParams: { conversationId },
  } = useUrlParams<ConversationRouteParams>()
  const { account } = useAuthContext()
  const webSocket = useWebSocketContext()
  const [composingMembers, setComposingMembers] = useState<ConversationMember[]>([])

  const conversationInfosQuery = useConversationInfosQuery(conversationId!)
  const membersQuery = useMembersQuery(conversationId!)

  const isError = useMemo(
    () => conversationInfosQuery.isError || membersQuery.isError,
    [conversationInfosQuery.isError, membersQuery.isError],
  )

  const isLoading = useMemo(
    () => conversationInfosQuery.isLoading || membersQuery.isLoading,
    [conversationInfosQuery.isLoading, membersQuery.isLoading],
  )

  const conversationInfos = conversationInfosQuery.data
  const members = membersQuery.data

  const filteredMembers = members?.filter((member) => member.contact.uri !== account.getUri())

  const conversationDisplayName = useConversationDisplayName(account, conversationInfos, filteredMembers)

  const onComposingStatusChanged = useCallback(
    (data: ComposingStatus) => {
      setComposingMembers((prevComposingMembers) => {
        if (!data.isWriting) {
          return prevComposingMembers.filter(({ contact }) => contact.uri !== data.contactId)
        }

        const isAlreadyIncluded = prevComposingMembers.find((member) => member.contact.uri === data.contactId)
        if (isAlreadyIncluded) {
          return prevComposingMembers
        }

        const member = members?.find((member) => member.contact.uri === data.contactId)
        if (!member) {
          return prevComposingMembers
        }

        return [...prevComposingMembers, member]
      })
    },
    [members],
  )

  const setupWebSocketBindings = useCallback(() => {
    if (!conversationInfos || !conversationId) {
      return undefined
    }

    const conversationView: ConversationView = {
      conversationId,
    }

    webSocket.send(WebSocketMessageType.ConversationView, conversationView)
    webSocket.bind(WebSocketMessageType.ComposingStatus, onComposingStatusChanged)

    const conversationMemberEventHandler = (data: ConversationMemberEvent) => {
      if (data.conversationId === conversationId) {
        membersQuery.refetch()
      }
    }

    webSocket.bind(WebSocketMessageType.ConversationMemberEvent, conversationMemberEventHandler)

    return () => {
      webSocket.unbind(WebSocketMessageType.ComposingStatus, onComposingStatusChanged)
      webSocket.unbind(WebSocketMessageType.ConversationMemberEvent, conversationMemberEventHandler)
    }
  }, [conversationId, conversationInfos, onComposingStatusChanged, webSocket, membersQuery])

  useLayoutEffect(() => {
    const cleanup = setupWebSocketBindings()
    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [setupWebSocketBindings])

  const value = useMemo(() => {
    if (!conversationId || !conversationDisplayName || !conversationInfos || !members) {
      return
    }

    return {
      conversationId,
      conversationDisplayName,
      conversationInfos,
      members,
      composingMembers,
      isPending: false,
    }
  }, [conversationId, conversationDisplayName, conversationInfos, members, composingMembers])

  if (isLoading) {
    return <LoadingPage />
  }
  if (isError || !value) {
    return <div>Error loading conversation: {conversationId}</div>
  }

  return <ConversationContext value={value}>{children}</ConversationContext>
}
