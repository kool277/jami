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
import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'

import LoadingPage from '../components/Loading.js'
import { useConversationDisplayName } from '../hooks/useConversationDisplayName.js'
import { useUrlParams } from '../hooks/useUrlParams.js'
import { ConversationMember } from '../models/conversation-member.js'
import NotFoundPage from '../pages/NotFound.js'
import { PendingConversationRouteParams } from '../router.js'
import { useContactListQuery, useContactsSearchQuery } from '../services/contactQueries.js'
import { resolvePendingConversationTarget } from '../utils/pendingConversation.js'
import { WithChildren } from '../utils/utils.js'
import { useAuthContext } from './AuthProvider.js'
import { ConversationContext } from './ConversationProvider.js'

/** A pending conversation is one-to-one: it exists to invite a single peer. */
const ONE_TO_ONE_MODE = '0'

/**
 * Backs the chat view of a peer that has not been invited yet, so searching for
 * an account opens a conversation instead of a dialog. The swarm only comes into
 * existence once the first message is sent, so everything shown here is
 * synthesized from the peer the URL points at.
 */
export default ({ children }: WithChildren) => {
  const {
    urlParams: { contactUri },
  } = useUrlParams<PendingConversationRouteParams>()
  const { account } = useAuthContext()

  const contactListQuery = useContactListQuery()
  const lookupQuery = useContactsSearchQuery(contactUri ?? '')

  const target = useMemo(
    () => resolvePendingConversationTarget(contactUri ?? '', contactListQuery.data, lookupQuery.data),
    [contactUri, contactListQuery.data, lookupQuery.data],
  )

  const contact = target.type === 'pending' ? target.contact : undefined
  const members = useMemo(() => (contact ? [new ConversationMember('member', contact)] : []), [contact])
  const conversationInfos = useMemo(() => ({ mode: ONE_TO_ONE_MODE }), [])
  const conversationDisplayName = useConversationDisplayName(account, conversationInfos, members)

  const value = useMemo(
    () =>
      contact
        ? {
            conversationId: '',
            conversationDisplayName,
            conversationInfos,
            members,
            composingMembers: [],
            isPending: true,
            pendingContact: contact,
          }
        : undefined,
    [contact, conversationDisplayName, conversationInfos, members],
  )

  if (target.type === 'unknown' && (contactListQuery.isLoading || lookupQuery.isLoading)) {
    // Only an unresolved peer is worth waiting for: the name server lookup can
    // stay pending indefinitely when the daemon cannot reach it, and an account
    // URI is already enough to open the chat.
    return <LoadingPage />
  }

  if (target.type === 'existing') {
    // The peer was invited from another device or tab in the meantime.
    return <Navigate to={`/conversation/${target.conversationId}`} replace />
  }

  if (!value) {
    return <NotFoundPage />
  }

  return <ConversationContext value={value}>{children}</ConversationContext>
}
