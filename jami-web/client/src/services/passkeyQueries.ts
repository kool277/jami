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
import { AccessToken } from '@savoirfairelinux/jami-web-common'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { use } from 'react'
import { useNavigate } from 'react-router-dom'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { apiUrl } from '../utils/constants.js'
import { setAccessToken } from './authQueries.js'

export interface PasskeyCredentialInfo {
  credentialId: string
  name: string
  createdAt: string
}

/** Register a new passkey for the current authenticated user */
export const useRegisterPasskeyMutation = () => {
  const { axiosInstance } = useAuthContext()
  const { setAlertContent } = use(AlertSnackbarContext)
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['passkey', 'register'],
    mutationFn: async (name: string) => {
      // 1. Get registration options from the server
      const { data: options } = await axiosInstance.post('/passkey/register/options')

      // 2. Start the WebAuthn ceremony in the browser
      const credential = await startRegistration({ optionsJSON: options })

      // 3. Send the result back for verification
      const { data } = await axiosInstance.post('/passkey/register/verify', {
        credential,
        name,
      })
      return data
    },
    onSuccess: () => {
      setAlertContent({ messageI18nKey: 'passkey_register_success', severity: 'success', alertOpen: true })
      queryClient.invalidateQueries({ queryKey: ['passkey', 'credentials'] })
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'passkey_register_error', severity: 'error', alertOpen: true })
    },
  })
}

/** Login with a passkey (public — no token needed) */
export const usePasskeyLoginMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent, closeAlert } = use(AlertSnackbarContext)

  return useMutation({
    mutationKey: ['passkey', 'login'],
    mutationFn: async (username?: string) => {
      // 1. Get authentication options
      const { data: options } = await axios.post('/passkey/login/options', username ? { username } : {}, {
        baseURL: apiUrl,
      })
      const { challengeKey, ...optionsJSON } = options

      // 2. Browser WebAuthn ceremony
      const credential = await startAuthentication({ optionsJSON })

      // 3. Verify
      const { data } = await axios.post<AccessToken>(
        '/passkey/login/verify',
        { challengeKey, credential },
        { baseURL: apiUrl },
      )
      return data
    },
    onMutate: () => closeAlert(),
    onSuccess: (response) => {
      setAccessToken(response.accessToken)
      navigate('/conversation', { replace: true })
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'passkey_login_error', severity: 'error', alertOpen: true })
    },
  })
}

/** List passkeys for the current user */
export const usePasskeyCredentialsQuery = () => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['passkey', 'credentials'],
    queryFn: async (): Promise<PasskeyCredentialInfo[]> => {
      const { data } = await axiosInstance.get('/passkey/credentials')
      return data
    },
  })
}

/** Delete a passkey */
export const useDeletePasskeyMutation = () => {
  const { axiosInstance } = useAuthContext()
  const { setAlertContent } = use(AlertSnackbarContext)
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['passkey', 'delete'],
    mutationFn: async (credentialId: string) => {
      await axiosInstance.delete(`/passkey/credentials/${encodeURIComponent(credentialId)}`)
    },
    onSuccess: () => {
      setAlertContent({ messageI18nKey: 'passkey_delete_success', severity: 'success', alertOpen: true })
      queryClient.invalidateQueries({ queryKey: ['passkey', 'credentials'] })
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'passkey_delete_error', severity: 'error', alertOpen: true })
    },
  })
}
