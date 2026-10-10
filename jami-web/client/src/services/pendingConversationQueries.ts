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
import { ContactDetails } from '@savoirfairelinux/jami-web-common'
import { useMutation } from '@tanstack/react-query'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useRefreshConversationsSummaries } from './conversationQueries.js'

export interface StartConversationVariables {
  contactUri: string
  /** Sent as the first message of the conversation the invitation creates. */
  body?: string
  files?: FormData
}

/**
 * Invites a peer and delivers the content that triggered the invitation. Adding
 * the contact is what creates the swarm, so the message can only be sent once
 * the server has answered with its ID.
 */
export const useStartConversationMutation = () => {
  const { axiosInstance } = useAuthContext()
  const refreshConversationsSummaries = useRefreshConversationsSummaries()

  return useMutation({
    mutationFn: async ({ contactUri, body, files }: StartConversationVariables) => {
      const { data } = await axiosInstance.put<ContactDetails>(`/contacts/${contactUri}`)
      const conversationId = data.conversationId
      if (!conversationId) {
        throw new Error(`No conversation was created for the invitation of ${contactUri}`)
      }

      if (body) {
        await axiosInstance.post(`/conversations/${conversationId}/messages`, { body })
      }
      if (files) {
        await axiosInstance.post(`/data/${conversationId}`, files, {
          headers: { 'Content-Type': 'multipart/form-data', Accept: '*/*' },
        })
      }

      return conversationId
    },
    onSuccess: () => {
      refreshConversationsSummaries()
    },
  })
}
