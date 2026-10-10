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
  AccessToken,
  AccountOverview,
  AdminCreateAccountRequest,
  AdminResetAccountPasswordRequest,
  AdminSettingSelection,
  IAdminConfigState,
} from '@savoirfairelinux/jami-web-common'
import { AdminWizardState, HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { use, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { AuthenticationMethods } from '../../enums/authenticationMethods.js'
import { apiUrl, jamiUsernamePattern } from '../../utils/constants.js'

export { useGetAdminConfigQuery } from '../../services/adminConfigQueries.js'

export type AdminUsernameAvailability = 'available' | 'taken' | 'invalid'

const getAdminAuthorizationHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('adminAccessToken')}`,
})

export const useCheckAdminUsernameAvailabilityQuery = (username: string) =>
  useQuery({
    queryKey: ['admin', 'nameserver', 'username', username],
    queryFn: async (): Promise<AdminUsernameAvailability> => {
      try {
        await axios.head(`/admin/nameserver/username/${encodeURIComponent(username)}`, {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        })
        return 'taken'
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === HttpStatusCode.NotFound) return 'available'
          if (error.response?.status === HttpStatusCode.BadRequest) return 'invalid'
        }
        throw error
      }
    },
    enabled: jamiUsernamePattern.test(username),
    retry: false,
  })

export const useSetupAdminMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent } = use(AlertSnackbarContext)

  return useMutation({
    mutationKey: ['admin', 'setup'],
    mutationFn: async (password: string) => {
      const { data } = await axios.post('/admin/create', { password }, { baseURL: apiUrl })
      return data
    },
    onSuccess: (data) => {
      //Logged in because it is the first step of the wizard
      //TODO:implement multi-factor authentication
      localStorage.setItem('adminAccessToken', data.accessToken)
      navigate('/admin/setup/ns')
    },
    onError: (e: any) => {
      if (e.response?.status === HttpStatusCode.BadRequest) {
        setAlertContent({
          messageI18nKey: 'login_invalid_credentials',
          severity: 'error',
          alertOpen: true,
        })
      } else {
        setAlertContent({
          messageI18nKey: 'unknown_error_alert',
          severity: 'error',
          alertOpen: true,
        })
      }
    },
  })
}

export const useLoginAdminMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent } = use(AlertSnackbarContext)

  return useMutation({
    mutationKey: ['admin', 'login'],
    mutationFn: async (password: string) => {
      const { data } = await axios.post<AccessToken>('/admin/login', { password }, { baseURL: apiUrl })
      return data
    },
    onSuccess: (data) => {
      localStorage.setItem('adminAccessToken', data.accessToken)
      navigate('/admin')
    },
    onError: (e: any) => {
      if (e.response?.status === HttpStatusCode.Forbidden) {
        setAlertContent({
          messageI18nKey: 'admin_page_setup_not_complete',
          severity: 'error',
          alertOpen: true,
        })
      } else if (e.response?.status === HttpStatusCode.BadRequest) {
        setAlertContent({
          messageI18nKey: 'password_input_helper_text_empty',
          severity: 'error',
          alertOpen: true,
        })
      } else if (e.response?.status === HttpStatusCode.Unauthorized) {
        setAlertContent({
          messageI18nKey: 'login_invalid_credentials',
          severity: 'error',
          alertOpen: true,
        })
      } else if (e.response?.status === HttpStatusCode.TooManyRequests) {
        setAlertContent({
          messageI18nKey: 'too_many_requests',
          severity: 'error',
          alertOpen: true,
        })
      } else {
        setAlertContent({
          messageI18nKey: 'unknown_error_alert',
          severity: 'error',
          alertOpen: true,
        })
      }
    },
  })
}

export const useSetWizardStateMutation = () => {
  return useMutation({
    mutationKey: ['admin', 'wizard', 'state'],
    mutationFn: async (state: AdminWizardState) => {
      const { data } = await axios.post(
        '/admin/admin-wizard-state',
        { state },
        {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        },
      )
      return data
    },
  })
}

//For react components that can invoke hooks
export const useCheckAdminSetupStatusQuery = () => {
  return useQuery({
    queryKey: ['admin', 'status'],
    queryFn: async () => {
      const { data } = await axios.get<{ isSetupComplete: boolean }>('/admin/check', { baseURL: apiUrl })
      return data.isSetupComplete
    },
  })
}

export const useGetNameServer = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const query = useQuery({
    queryKey: ['nameserver', 'getter'],
    queryFn: async () => {
      const { data } = await axios.get('/admin/nameserver', {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
  })
  useEffect(() => {
    if (query.error) {
      setAlertContent({
        messageI18nKey: 'getting_name_server_error',
        severity: 'error',
        alertOpen: true,
      })
    }
  }, [query.error, setAlertContent])

  return query
}

export const useResetNameServer = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['nameserver', 'reset'],
    mutationFn: async () => {
      const { data } = await axios.delete(`/admin/nameserver`, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nameserver', 'getter'] })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'setting_name_server_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useSetNameServer = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['nameserver', 'setter'],
    mutationFn: async (nameserver: string) => {
      const { data } = await axios.post(
        '/admin/nameserver',
        { nameserver },
        {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nameserver', 'getter'] })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'setting_name_server_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useUpdateAdminConfigMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent } = use(AlertSnackbarContext)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (adminConfig: Partial<IAdminConfigState>) => {
      const response = await axios.patch('/admin/config', adminConfig, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] })
    },
    onError: (e: any) => {
      if (e.response.status === HttpStatusCode.Unauthorized) {
        localStorage.removeItem('adminAccessToken')
        navigate('/admin/login')
      } else {
        setAlertContent({
          messageI18nKey: 'unknown_error_alert',
          severity: 'error',
          alertOpen: true,
        })
      }
    },
  })
}

export const useUpdateAdminPasswordMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent } = use(AlertSnackbarContext)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (passwords: { old: string; new: string }) => {
      const response = await axios.patch('/admin/password', passwords, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'password'] })
      setAlertContent({
        messageI18nKey: 'admin_password_changed_successfully',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: (e: any) => {
      if (e.response.status === HttpStatusCode.Unauthorized && e.response.data !== 'Incorrect password') {
        localStorage.removeItem('adminAccessToken')
        navigate('/admin/login')
      } else if (e.response.status === HttpStatusCode.Unauthorized && e.response.data === 'Incorrect password') {
        setAlertContent({
          messageI18nKey: 'incorrect_password',
          severity: 'error',
          alertOpen: true,
        })
      } else {
        setAlertContent({
          messageI18nKey: 'unknown_error_alert',
          severity: 'error',
          alertOpen: true,
        })
      }
    },
  })
}

export const getAdminAuthMethods = async () => {
  try {
    const response = await axios.get('/admin/config', {
      baseURL: apiUrl,
      headers: getAdminAuthorizationHeaders(),
    })
    return [
      response.data.localAuthEnabled,
      response.data.jamsAuthEnabled,
      response.data.guestAccessEnabled,
      response.data.openIdAuthEnabled,
    ]
  } catch (e: any) {
    console.log('Erreur ', e)
  }
}

export const useGetJamsUrl = () => {
  return useQuery({
    queryKey: ['jamsurl', 'getter'],
    queryFn: async () => {
      const { data } = await axios.get('/admin/jams-url', {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
  })
}
export const useRemoveJamsUrl = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['jamsurl', 'reset'],
    mutationFn: async () => {
      const { data } = await axios.delete(`/admin/jams-url`, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jamsurl', 'getter'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'config'] })
      setAlertContent({
        messageI18nKey: 'removing_jams_server_success',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['jamsurl', 'getter'] })
      setAlertContent({
        messageI18nKey: 'removing_jams_server_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}
export const useSetJamsUrl = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['jamsurl', 'setter'],
    mutationFn: async (url: string) => {
      const { data } = await axios.post(
        '/admin/jams-url',
        { url },
        {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nameserver', 'getter'] })
      setAlertContent({
        messageI18nKey: 'setting_jams_server_success',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'setting_jams_server_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useGetAllAccounts = () => {
  return useQuery<AccountOverview[]>({
    queryKey: ['all', 'accounts'],
    queryFn: async () => {
      const { data } = await axios.get('/admin/accounts', {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
  })
}

export const useDeleteAccounts = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['delete', 'accounts'],
    mutationFn: async (accounts: AccountOverview[]) => {
      const { data } = await axios.delete(`/admin/accounts`, {
        data: accounts,
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all', 'accounts'] })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
        alertOpen: true,
      })
      queryClient.invalidateQueries({ queryKey: ['all', 'accounts'] })
    },
  })
}

export const useCreateAccount = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['create', 'account'],
    mutationFn: async (account: AdminCreateAccountRequest) => {
      const { data } = await axios.post<{ accountId: string }>('/admin/accounts', account, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all', 'accounts'] })
      setAlertContent({
        messageI18nKey: 'registration_success',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useResetAccountPassword = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['reset', 'account', 'password'],
    mutationFn: async ({ accountId, password }: AdminResetAccountPasswordRequest & { accountId: string }) => {
      await axios.patch(
        `/admin/accounts/${encodeURIComponent(accountId)}/password`,
        { password },
        {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        },
      )
    },
    onSuccess: () => {
      setAlertContent({
        messageI18nKey: 'account_password_changed_successfully',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const checkAdminTokenValidity = async () => {
  try {
    const response = await axios.get('/admin/is-token-valid', {
      baseURL: apiUrl,
      headers: getAdminAuthorizationHeaders(),
    })
    if (response.status === HttpStatusCode.Ok) {
      return true
    }
  } catch (e: any) {
    if (e.response?.status === HttpStatusCode.Unauthorized) {
      console.error('Admin token is invalid')
    }
  }
  return false
}

export const useGetAllOauthClients = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const query = useQuery({
    queryKey: ['all', 'oauth', 'clients'],
    queryFn: async () => {
      const { data } = await axios.get('/admin/oauth/providers', {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
  })
  useEffect(() => {
    if (query.error) {
      setAlertContent({
        messageI18nKey: 'getting_oauth_clients_error',
        severity: 'error',
        alertOpen: true,
      })
    }
  }, [query.error, setAlertContent])

  return query
}

export const useGetProviderInfo = (provider: string) => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const navigate = useNavigate()
  const query = useQuery({
    queryKey: ['oauth', 'provider', provider],
    queryFn: async () => {
      const { data } = await axios.get(`/admin/oauth/provider/${provider}`, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
  })
  useEffect(() => {
    if (query.error) {
      setAlertContent({
        messageI18nKey: 'getting_oauth_provider_info_error',
        severity: 'error',
        alertOpen: true,
      })
      navigate(`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.OPENID}`)
    }
  }, [navigate, query.error, setAlertContent])
  return query
}

export const useUpdateProviderInfo = (provider: string) => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['oauth', 'provider', provider],
    mutationFn: async (data: { clientId?: string; clientSecret?: string; isActive?: boolean }) => {
      const response = await axios.patch(`/admin/oauth/provider/${provider}`, data, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth', 'provider', provider] })
      setAlertContent({
        messageI18nKey: 'ouath_provider_updated_success',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useSetAutoDownloadLimit = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['set', 'autoDownloadLimit'],
    mutationFn: async (limit: number) => {
      const { data } = await axios.post(
        '/admin/auto-download-limit',
        { limit },
        {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get', 'autoDownloadLimit'] })
      setAlertContent({
        messageI18nKey: 'setting_auto_download_limit_success',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'setting_auto_download_limit_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useSetConferenceResolution = () => {
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['set', 'conferenceResolution'],
    mutationFn: async (resolution: string) => {
      const { data } = await axios.post(
        '/admin/conference-resolution',
        { resolution },
        {
          baseURL: apiUrl,
          headers: getAdminAuthorizationHeaders(),
        },
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get', 'conferenceResolution'] })
      setAlertContent({
        messageI18nKey: 'setting_conference_resolution_success',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'setting_conference_resolution_error',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

// ─── Admin passkey hooks ─────────────────────────────────────────────────────

export interface AdminPasskeyInfo {
  credentialId: string
  name: string
  createdAt: string
}

/** Check if admin has any registered passkeys */
export const useAdminPasskeyAvailableQuery = () => {
  return useQuery({
    queryKey: ['admin', 'passkey', 'available'],
    queryFn: async (): Promise<boolean> => {
      const { data } = await axios.get<{ available: boolean }>('/admin/passkey/available', { baseURL: apiUrl })
      return data.available
    },
  })
}

/** Login to admin panel with passkey */
export const useAdminPasskeyLoginMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent, closeAlert } = use(AlertSnackbarContext)

  return useMutation({
    mutationKey: ['admin', 'passkey', 'login'],
    mutationFn: async () => {
      const { data: options } = await axios.post('/admin/passkey/login/options', {}, { baseURL: apiUrl })
      const { challengeKey, ...optionsJSON } = options
      const credential = await startAuthentication({ optionsJSON })
      const { data } = await axios.post<AccessToken>(
        '/admin/passkey/login/verify',
        { challengeKey, credential },
        { baseURL: apiUrl },
      )
      return data
    },
    onMutate: () => closeAlert(),
    onSuccess: (data) => {
      localStorage.setItem('adminAccessToken', data.accessToken)
      navigate('/admin')
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'passkey_login_error', severity: 'error', alertOpen: true })
    },
  })
}

/** Register a new passkey for admin */
export const useAdminRegisterPasskeyMutation = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['admin', 'passkey', 'register'],
    mutationFn: async (name: string) => {
      const headers = getAdminAuthorizationHeaders()
      const { data: options } = await axios.post('/admin/passkey/register/options', {}, { baseURL: apiUrl, headers })
      const credential = await startRegistration({ optionsJSON: options })
      const { data } = await axios.post(
        '/admin/passkey/register/verify',
        { credential, name },
        { baseURL: apiUrl, headers },
      )
      return data
    },
    onSuccess: () => {
      setAlertContent({ messageI18nKey: 'passkey_register_success', severity: 'success', alertOpen: true })
      queryClient.invalidateQueries({ queryKey: ['admin', 'passkey'] })
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'passkey_register_error', severity: 'error', alertOpen: true })
    },
  })
}

/** List admin passkeys */
export const useAdminPasskeyCredentialsQuery = () => {
  const [hasToken] = useState(() => Boolean(localStorage.getItem('adminAccessToken')))
  return useQuery({
    queryKey: ['admin', 'passkey', 'credentials'],
    queryFn: async (): Promise<AdminPasskeyInfo[]> => {
      const { data } = await axios.get('/admin/passkey/credentials', {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
      return data
    },
    enabled: hasToken,
  })
}

/** Delete an admin passkey */
export const useAdminDeletePasskeyMutation = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['admin', 'passkey', 'delete'],
    mutationFn: async (credentialId: string) => {
      await axios.delete(`/admin/passkey/credentials/${encodeURIComponent(credentialId)}`, {
        baseURL: apiUrl,
        headers: getAdminAuthorizationHeaders(),
      })
    },
    onSuccess: () => {
      setAlertContent({ messageI18nKey: 'passkey_delete_success', severity: 'success', alertOpen: true })
      queryClient.invalidateQueries({ queryKey: ['admin', 'passkey'] })
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'passkey_delete_error', severity: 'error', alertOpen: true })
    },
  })
}
