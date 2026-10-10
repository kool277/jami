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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  applyReadStateOverrides,
  conversationRequestsQueryKey,
  normalizeConversationRequests,
  useAddConversationRequestToCache,
  useConversationPreferencesQuery,
  useKeepConversationSummaryRead,
  useRemoveConversationRequestFromCache,
} from './conversationQueries.js'

vi.mock('../contexts/AuthProvider.js', () => ({
  useAuthContext: () => ({ axiosInstance: { get: vi.fn() } }),
}))

const request = {
  conversationId: 'request-id',
  infos: {},
  from: { uri: 'contact-uri' },
  received: '0',
  membersNames: [],
}

describe('normalizeConversationRequests', () => {
  it('normalizes a single received request into an array', () => {
    expect(normalizeConversationRequests(request)).toEqual([request])
  })

  it('preserves request arrays', () => {
    expect(normalizeConversationRequests([request])).toEqual([request])
  })
})

describe('conversation request cache updates', () => {
  const renderWithClient = <T,>(hook: () => T) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return { queryClient, ...renderHook(hook, { wrapper }) }
  }

  it('writes a pushed request where the requests query reads it', () => {
    const { queryClient, result } = renderWithClient(() => useAddConversationRequestToCache())

    result.current(request)

    expect(queryClient.getQueryData(conversationRequestsQueryKey)).toEqual([request])
  })

  it('removes a request from where the requests query reads it', () => {
    const { queryClient, result } = renderWithClient(() => useRemoveConversationRequestFromCache())
    queryClient.setQueryData(conversationRequestsQueryKey, [request])

    result.current(request.conversationId)

    expect(queryClient.getQueryData(conversationRequestsQueryKey)).toEqual([])
  })
})

describe('active conversation read state', () => {
  it('rejects a stale unread count for the last message read locally', () => {
    const summaries = [
      { id: 'active-conversation', unreadMessages: 1, lastMessage: { id: 'read-message' } },
      { id: 'other-conversation', unreadMessages: 2, lastMessage: { id: 'other-message' } },
    ]
    const readMessages = new Map([['active-conversation', 'read-message']])

    const updated = applyReadStateOverrides(summaries, readMessages)

    expect(updated[0].unreadMessages).toBe(0)
    expect(updated[1].unreadMessages).toBe(2)
  })

  it('keeps unread counts when a newer message replaces the local read watermark', () => {
    const summaries = [{ id: 'active-conversation', unreadMessages: 1, lastMessage: { id: 'new-message' } }]
    const readMessages = new Map([['active-conversation', 'read-message']])

    expect(applyReadStateOverrides(summaries, readMessages)).toBe(summaries)
  })

  it('keeps the active conversation read after a summaries refresh', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const summaries = [{ id: 'active-conversation', unreadMessages: 3 }]
    queryClient.setQueryData(['conversations', 'summaries'], summaries)

    const { result } = renderHook(() => useKeepConversationSummaryRead('active-conversation'), { wrapper })

    await vi.waitFor(() => {
      expect(queryClient.getQueryData<typeof summaries>(['conversations', 'summaries'])?.[0].unreadMessages).toBe(0)
    })

    queryClient.setQueryData(['conversations', 'summaries'], summaries)

    await vi.waitFor(() => {
      expect(queryClient.getQueryData<typeof summaries>(['conversations', 'summaries'])?.[0].unreadMessages).toBe(0)
    })

    expect(result.current).toBeUndefined()
  })
})

describe('deferred conversation preferences', () => {
  it('does not fetch preferences while disabled', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useConversationPreferencesQuery('conversation-id', false), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})
