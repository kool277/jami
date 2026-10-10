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
import {
  type ApiTokenInfo,
  type CreateApiTokenRequest,
  type CreateApiTokenResponse,
} from '@savoirfairelinux/jami-web-common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthContext } from '../contexts/AuthProvider.js'

const apiTokensQueryKey = ['api-tokens'] as const

export function useApiTokensQuery() {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: apiTokensQueryKey,
    queryFn: async (): Promise<ApiTokenInfo[]> => {
      const { data } = await axiosInstance.get('/tokens')
      return data
    },
  })
}

export function useCreateApiTokenMutation() {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['api-tokens', 'create'],
    mutationFn: async (request: CreateApiTokenRequest): Promise<CreateApiTokenResponse> => {
      const { data } = await axiosInstance.post('/tokens', request)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiTokensQueryKey }),
  })
}

export function useRevokeApiTokenMutation() {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['api-tokens', 'revoke'],
    mutationFn: async (tokenId: string) => {
      await axiosInstance.delete(`/tokens/${encodeURIComponent(tokenId)}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiTokensQueryKey }),
  })
}
