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
  ConversationInfos,
  ConversationPreferences,
  IConversationMember,
  IConversationRequest,
  IConversationSummary,
  Message,
} from '@savoirfairelinux/jami-web-common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosResponse } from 'axios'
import { use, useCallback, useEffect } from 'react'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { ConversationMember } from '../models/conversation-member.js'
import { useAddToCache, useRemoveFromCache } from '../utils/reactquery.js'
import { markSummaryRead } from '../utils/readReceipts.js'

const readMessagesByAccount = new Map<string, Map<string, string>>()

export const applyReadStateOverrides = <T extends { id: string; lastMessage: { id: string }; unreadMessages: number }>(
  summaries: T[],
  readMessages: ReadonlyMap<string, string>,
): T[] => {
  const hasStaleCount = summaries.some(
    (summary) => readMessages.get(summary.id) === summary.lastMessage.id && summary.unreadMessages !== 0,
  )
  if (!hasStaleCount) {
    return summaries
  }

  return summaries.map((summary) =>
    readMessages.get(summary.id) === summary.lastMessage.id ? { ...summary, unreadMessages: 0 } : summary,
  )
}

export const useConversationInfosQuery = (conversationId?: string) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['conversations', conversationId],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ConversationInfos>(`/conversations/${conversationId}/infos`)
      return data
    },
    enabled: !!conversationId,
  })
}

export const useConversationInfosMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationInfos: ConversationInfos) =>
      axiosInstance.post(`/conversations/${conversationId}/infos`, conversationInfos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', conversationId] })
    },
  })
}

export const useConversationsSummariesQuery = (enabled = true) => {
  const { accountId, axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['conversations', 'summaries'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<IConversationSummary[]>(`/conversations`)
      return applyReadStateOverrides(data, readMessagesByAccount.get(accountId) ?? new Map())
    },
    enabled,
  })
}

const checkConversationSummariesAreEqual = (
  conversationSummary1: IConversationSummary,
  conversationSummary2: IConversationSummary,
) => conversationSummary1.id === conversationSummary2.id
const checkIsConversationSummaryFn = (conversationSummary: IConversationSummary, conversationId: string) =>
  conversationSummary.id === conversationId

export const useAddConversationSummaryToCache = () =>
  useAddToCache(['conversations', 'summaries'], checkConversationSummariesAreEqual)
export const useRemoveConversationSummaryFromCache = () =>
  useRemoveFromCache(['conversations', 'summaries'], checkIsConversationSummaryFn)

export const useRemoveConversationMutation = () => {
  const { axiosInstance } = useAuthContext()
  const removeConversationSummaryFromCache = useRemoveConversationSummaryFromCache()

  return useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) =>
      axiosInstance.delete(`/conversations/${conversationId}`),
    onSuccess: (_data, { conversationId }) => {
      removeConversationSummaryFromCache(conversationId)
    },
  })
}

export const useMarkConversationSummaryRead = () => {
  const queryClient = useQueryClient()
  return useCallback(
    (conversationId: string) => {
      queryClient.setQueryData<IConversationSummary[]>(['conversations', 'summaries'], (summaries) =>
        summaries ? markSummaryRead(summaries, conversationId) : summaries,
      )
    },
    [queryClient],
  )
}

/**
 * Prevents a stale summaries refresh from restoring the unread badge while
 * the user is actively viewing that conversation.
 */
export const useKeepConversationSummaryRead = (conversationId: string, lastReadMessageId?: string) => {
  const { accountId } = useAuthContext()
  const { data: summaries } = useConversationsSummariesQuery()
  const markConversationSummaryRead = useMarkConversationSummaryRead()

  useEffect(() => {
    if (lastReadMessageId) {
      const readMessages = readMessagesByAccount.get(accountId) ?? new Map<string, string>()
      readMessages.set(conversationId, lastReadMessageId)
      readMessagesByAccount.set(accountId, readMessages)
    }
    markConversationSummaryRead(conversationId)
  }, [accountId, conversationId, lastReadMessageId, markConversationSummaryRead, summaries])
}

export const useRefreshConversationsSummaries = () => {
  const queryClient = useQueryClient()
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['conversations', 'summaries'] })
  }, [queryClient])
}

export const useMembersQuery = (conversationId?: string) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['conversations', conversationId, 'members'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<IConversationMember[]>(`/conversations/${conversationId}/members`)
      return data.map((item) => ConversationMember.fromInterface(item))
    },
    enabled: !!conversationId,
    staleTime: Infinity,
  })
}

export const useMessagesQuery = (conversationId: string, needToFetch: boolean) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['conversations', conversationId, 'messages'],
    queryFn: async () => {
      const { data } = await axiosInstance.get<Message[]>(`/conversations/${conversationId}/messages`)
      return data
    },
    enabled: !!conversationId && needToFetch,
  })
}

export const useSendMessageMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, replyTo }: { body: string; replyTo?: string }) =>
      axiosInstance.post(`/conversations/${conversationId}/messages`, {
        body,
        replyTo,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
  })
}

export const useTransferMessageMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationFn: ({
      messageBody,
      targetedConversations,
      comment,
    }: {
      messageBody: string
      targetedConversations: string[]
      comment: string | undefined
    }) =>
      axiosInstance.post(`/conversations/${conversationId}/transfer-message/`, {
        messageBody,
        targetedConversations,
        comment,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
    onError: () => {
      setAlertContent({
        messageI18nKey: 'error_cannot_transfer_message',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useEditMessageMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, messageId }: { body: string; messageId: string }) =>
      axiosInstance.post(`/conversations/${conversationId}/edit-message`, {
        body,
        messageId,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
  })
}

export const useDeleteMessageMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationFn: (messageId: string) => axiosInstance.delete(`/conversations/delete/${conversationId}/${messageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
    onError: () => {
      setAlertContent({
        messageI18nKey: 'error_cannot_delete_message',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

const CheckConversationRequestsAreEqual = (
  conversationRequest1: IConversationRequest,
  conversationRequest2: IConversationRequest,
) => conversationRequest1.conversationId === conversationRequest2.conversationId
const checkIsConversationRequestFn = (conversationRequest: IConversationRequest, conversationId: string) =>
  conversationRequest.conversationId === conversationId

export const normalizeConversationRequests = (
  requests: IConversationRequest[] | IConversationRequest | undefined,
): IConversationRequest[] => (Array.isArray(requests) ? requests : requests ? [requests] : [])

export const conversationRequestsQueryKey = ['conversationRequests']

export const useAddConversationRequestToCache = () =>
  useAddToCache(conversationRequestsQueryKey, CheckConversationRequestsAreEqual)
export const useRemoveConversationRequestFromCache = () =>
  useRemoveFromCache(conversationRequestsQueryKey, checkIsConversationRequestFn)

export const useConversationRequestsQuery = () => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: conversationRequestsQueryKey,
    queryFn: async () => {
      const { data } = await axiosInstance.get<IConversationRequest[]>('/conversation-requests/')
      return normalizeConversationRequests(data)
    },
    select: normalizeConversationRequests,
  })
}

export const useAcceptConversationRequestMutation = () => {
  const { axiosInstance } = useAuthContext()
  const addConversationSummaryToCache = useAddConversationSummaryToCache()
  const removeConversationRequestFromCache = useRemoveConversationRequestFromCache()
  return useMutation({
    mutationFn: async (variables: { conversationId: string }) => {
      const { data } = await axiosInstance.post<undefined, AxiosResponse<IConversationSummary>>(
        `/conversation-requests/${variables.conversationId}`,
      )
      return data
    },
    onSuccess: (data, { conversationId }) => {
      addConversationSummaryToCache(data)
      removeConversationRequestFromCache(conversationId)
    },
  })
}

export const useBlockConversationRequestMutation = () => {
  const { axiosInstance } = useAuthContext()
  const removeConversationRequestFromCache = useRemoveConversationRequestFromCache()
  return useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) =>
      axiosInstance.post(`/conversation-requests/${conversationId}/block`),
    onSuccess: (_data, { conversationId }) => {
      removeConversationRequestFromCache(conversationId)
    },
  })
}

export const useDeclineConversationRequestMutation = () => {
  const { axiosInstance } = useAuthContext()
  const removeConversationRequestFromCache = useRemoveConversationRequestFromCache()
  return useMutation({
    mutationFn: ({ conversationId }: { conversationId: string }) =>
      axiosInstance.delete(`/conversation-requests/${conversationId}`),
    onSuccess: (_data, { conversationId }) => {
      removeConversationRequestFromCache(conversationId)
    },
  })
}

export const useAddMemberToSwarm = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactUri: string[]) =>
      axiosInstance.post(`/conversations/${conversationId}/add-to-swarm`, { contactUri }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'summaries'] })
    },
  })
}

export const useRemoveMemberFromSwarm = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactUri: string) =>
      axiosInstance.post(`/conversations/${conversationId}/remove-from-swarm`, { contactUri }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'summaries'] })
    },
  })
}

export const useConversationPreferencesQuery = (conversationId: string, enabled = true) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['conversationPreferences', conversationId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/conversations/${conversationId}/preferences`)
      return data
    },
    enabled: enabled && !!conversationId,
  })
}

export const useConversationPreferencesMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationFn: (preferences: ConversationPreferences) =>
      axiosInstance.post(`/conversations/${conversationId}/preferences`, preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversationPreferences', conversationId] })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'update_conversation_preferences_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useGetAllFilesQuery = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['conversations', conversationId, 'files'],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/conversations/${conversationId}/files`)
      return data
    },
  })
}
