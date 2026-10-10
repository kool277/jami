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
import { ContactDetails, HttpStatusCode, JamsSearchResult, LookupResult } from '@savoirfairelinux/jami-web-common'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { Contact } from '../models/contact.js'
import { jamiAddressPattern } from '../utils/pendingConversation.js'
import { useRefreshConversationsSummaries } from './conversationQueries.js'

function isLookupMiss(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === HttpStatusCode.BadRequest || error.response?.status === HttpStatusCode.NotFound)
  )
}

export const useContactsSearchQuery = (searchQuery: string) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['ns', 'username', searchQuery],
    queryFn: async () => {
      const query = searchQuery.trim()
      const isJamiAddress = jamiAddressPattern.test(query)
      const endpoint = isJamiAddress ? `/ns/address/${query}` : `/ns/name/${query}`

      try {
        const { data } = await axiosInstance.get<LookupResult>(endpoint)
        return data ? [new Contact(data.address || query, data.name)] : []
      } catch (error) {
        if (isLookupMiss(error)) {
          return isJamiAddress ? [new Contact(query)] : []
        }
        throw error
      }
    },
    enabled: !!searchQuery.trim(),
    retry: false,
  })
}

export const useJamsContactsSearchQuery = (searchQuery: string) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['jams', 'username', searchQuery],
    queryFn: async () => {
      const { data } = await axiosInstance.get<JamsSearchResult>(`/ns/jams/${searchQuery}`)
      if (data.state !== 0) {
        return []
      }
      const contacts = data.results.map((contact) => new Contact(contact.id, contact.username))
      return contacts
    },
    enabled: !!searchQuery.trim() && !jamiAddressPattern.test(searchQuery.trim()),
    retry: false,
  })
}

export const useContactQuery = (contactId?: string, enabled = true) => {
  const { axiosInstance } = useAuthContext()

  return useQuery({
    queryKey: ['contacts', contactId],
    queryFn: async () => {
      const { data } = await axiosInstance.get<ContactDetails>(`/contacts/${contactId}`)
      return data
    },
    enabled: enabled && !!contactId,
  })
}

export const useAddContactMutation = () => {
  const { axiosInstance } = useAuthContext()

  const refreshConversationsSummaries = useRefreshConversationsSummaries()

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { data } = await axiosInstance.put<ContactDetails>(`/contacts/${contactId}`)
      return data
    },
    onSuccess: () => {
      refreshConversationsSummaries()
    },
  })
}
export const useContactListQuery = () => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['contact', 'list'],
    queryFn: async ({ signal }) => {
      const { data } = await axiosInstance.get<ContactDetails[]>(`/contacts`, { signal })
      return data
    },
  })
}

export const useRemoveContactMutation = () => {
  const queryClient = useQueryClient()
  const { axiosInstance } = useAuthContext()
  return useMutation({
    mutationKey: ['contact', 'remove'],
    mutationFn: async (contactId: string) => {
      const { data } = await axiosInstance.delete(`/contacts/${contactId}`)
      return data
    },
    onSuccess: (_data, contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact', 'list'] })
      queryClient.removeQueries({ queryKey: ['contacts', contactId] })
    },
    onError: () => {
      console.log(`Error deleting contact`)
      queryClient.invalidateQueries({ queryKey: ['contact', 'list'] })
    },
  })
}

export const useBlockContactMutation = () => {
  const queryClient = useQueryClient()
  const { axiosInstance } = useAuthContext()
  return useMutation({
    mutationKey: ['contact', 'block'],
    mutationFn: async (contactId: string) => {
      const { data } = await axiosInstance.post(`/contacts/${contactId}/block`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', 'list'] })
    },
    onError: () => {
      console.log(`Error blocking contact`)
      queryClient.invalidateQueries({ queryKey: ['contact', 'list'] })
    },
  })
}

export const useContactProfilePicture = (contactId?: string, enabled = true) => {
  const { axiosInstance } = useAuthContext()

  return useQuery({
    queryKey: ['picture', contactId],
    queryFn: async () => {
      const { data, status } = await axiosInstance.get<File>(`/contacts/${contactId}/profile/picture`, {
        responseType: 'blob',
      })
      if (status === 204) {
        return null
      }
      const blobUrl = URL.createObjectURL(data)
      return blobUrl
    },
    enabled: !!contactId && enabled,
    retry: false,
    staleTime: Infinity,
  })
}

export const useGetLinkUsername = (contactId?: string) => {
  // only use in ImportAccountLock
  // note that the token used is different
  // from the one used everywhere else
  return useQuery({
    queryKey: ['linkUsername', contactId],
    queryFn: async () => {
      const token = localStorage.getItem('importToken')
      const { data } = await axios.get<string>(`/contacts/${contactId}/username`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return data
    },
    enabled: !!contactId,
  })
}
