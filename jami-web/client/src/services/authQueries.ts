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

import { AccessToken, HttpStatusCode, MIN_PASSWORD_LENGTH } from '@savoirfairelinux/jami-web-common'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { passwordStrength } from 'check-password-strength'
import { use } from 'react'
import { useNavigate } from 'react-router-dom'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { PasswordStrength } from '../enums/passwordStrength.js'
import { apiUrl } from '../utils/constants.js'
import { jamiUsernamePattern } from '../utils/constants.js'
interface PasswordStrengthResult {
  id: number
  value: string
  contains: string[]
  length: number
}

interface LoginData {
  username: string
  password: string
  authMethod: string
}

interface RegisterData {
  username: string
  password: string
}

export interface PasswordCheckResult {
  strong: boolean
  valueCode: PasswordStrength
}

export type LoginMethod = 'Jami' | 'JAMS'
export type NameStatus = 'default' | 'success' | 'taken' | 'valid' | 'invalid' | 'registration_failed'
export type PasswordStatus = 'default' | PasswordStrength | 'registration_failed'

export const useCheckIfUsernameIsRegisteredQuery = (username: string) => {
  return useQuery({
    queryKey: ['username', username],
    queryFn: async (): Promise<{ responseMessage: NameStatus; statusCode: number }> => {
      try {
        const res = await axios.head(`/ns/name/${username}`, {
          baseURL: apiUrl,
        })
        return { responseMessage: res.status === 200 ? 'taken' : 'success', statusCode: res.status }
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 404) {
          return { responseMessage: 'success', statusCode: 404 }
        }
        if (status === 400) {
          return { responseMessage: 'invalid', statusCode: 400 }
        }
        throw e
      }
    },
    enabled: jamiUsernamePattern.test(username),
  })
}

export function checkPasswordStrength(password: string): PasswordCheckResult {
  const strengthResult: PasswordStrengthResult = passwordStrength(password, [
    {
      id: PasswordStrength.TooWeak,
      value: 'Too weak',
      minDiversity: 0,
      minLength: 0,
    },
    {
      id: PasswordStrength.Weak,
      value: 'Weak',
      minDiversity: 2,
      minLength: MIN_PASSWORD_LENGTH,
    },
    {
      id: PasswordStrength.Medium,
      value: 'Medium',
      minDiversity: 4,
      minLength: 8,
    },
    {
      id: PasswordStrength.Strong,
      value: 'Strong',
      minDiversity: 4,
      minLength: 10,
    },
  ])
  return {
    strong: password.length >= MIN_PASSWORD_LENGTH && strengthResult.id !== PasswordStrength.TooWeak,
    valueCode: strengthResult.id,
  }
}

export const useRegisterMutation = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['user', 'register'],
    mutationFn: async (registerData: RegisterData) => {
      const response = await axios.post(
        '/auth/new-account',
        { username: registerData.username, password: registerData.password },
        { baseURL: apiUrl },
      )
      return response
    },
    onSuccess: (response) => {
      if (response.status === HttpStatusCode.Created) {
        setAlertContent({ messageI18nKey: 'registration_success', severity: 'success', alertOpen: true })
      }
    },
    onError: (e: any) => {
      const { status } = e.response
      if (status === HttpStatusCode.BadRequest) {
        //TODO: more than one bad request response defined in the server is missing credentials. add the response message to the locale.
      } else if (status === HttpStatusCode.Conflict) {
        //TODO: there are two different conflict responses that could be returned by the server, use message to differentiate them?
      } else if (status === HttpStatusCode.Unauthorized) {
        //TODO: this is a response for JAMS, add message to the locale
      } else {
        setAlertContent({ messageI18nKey: 'unknown_error_alert', severity: 'error', alertOpen: true })
      }
    },
  })
}

export const useLoginMutation = () => {
  const navigate = useNavigate()
  const { setAlertContent, closeAlert } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['user', 'login'],
    mutationFn: async (loginData: LoginData) => {
      const { data } = await axios.post<AccessToken>(
        '/auth/login',
        { username: loginData.username, password: loginData.password, authMethod: loginData.authMethod },
        { baseURL: apiUrl },
      )
      return data
    },
    onMutate: () => {
      closeAlert()
    },
    onSuccess: (response) => {
      setAccessToken(response.accessToken)
      navigate('/conversation', { replace: true })
    },
    onError: (e: any) => {
      //e: any is a simple workaround for type check since the error is of type unknown and we are unable to reference a property on an unknown
      const status = e.response?.status
      if (status === HttpStatusCode.BadRequest) {
        //TODO: the only bad request response defined in the server is missing credentials. add the response message to the locale.
        //continue when the auth flow is clear
      } else if (status === HttpStatusCode.NotFound || status === HttpStatusCode.Unauthorized) {
        setAlertContent({ messageI18nKey: 'login_invalid_credentials', severity: 'error', alertOpen: true })
      } else if (status === HttpStatusCode.TooManyRequests) {
        setAlertContent({ messageI18nKey: 'too_many_requests', severity: 'error', alertOpen: true })
      } else {
        setAlertContent({ messageI18nKey: 'unknown_error_alert', severity: 'error', alertOpen: true })
      }
    },
  })
}

export function getAccessToken(): string | undefined {
  return localStorage.getItem('accessToken') ?? undefined
}

export function setAccessToken(accessToken: string): void {
  localStorage.setItem('accessToken', accessToken)
}

export const useExtendSessionForGuest = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  return useMutation({
    mutationKey: ['extend', 'session'],
    mutationFn: async () => {
      const token = localStorage.getItem('accessToken')
      const { data } = await axios.post(`/account/guest/extend`, {
        baseURL: apiUrl,
        headers: { Authorization: `Bearer ${token}` },
      })
      return data
    },
    onSuccess: (response) => {
      setAccessToken(response.accessToken)
      setAlertContent({
        messageI18nKey: 'extending_session_success_alert',
        severity: 'success',
        alertOpen: true,
      })
    },
    onError: () => {
      setAlertContent({
        messageI18nKey: 'extending_session_error_alert',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}
export const useGetAllProviders = () => {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const res = await axios.get('/auth/oauth/providers', { baseURL: apiUrl })
      return res.data
    },
    refetchOnWindowFocus: true,
    refetchInterval: 0,
  })
}

/*
 * Queries used only in the import account flow
 */

export function setImportToken(importToken: string): void {
  if (localStorage.getItem('importToken')) {
    localStorage.removeItem('importToken')
  }
  localStorage.setItem('importToken', importToken)
}

export const useGetLinkTokenQuery = () => {
  return useQuery({
    queryKey: ['linkToken'],
    queryFn: async () => {
      const { data } = await axios.get('/auth/link-token', { baseURL: apiUrl })
      setImportToken(data.jwt)
      return data
    },
    // Each request makes the daemon create an account and start a link operation, so a refetch
    // would leave the previous one dangling and swap the code the user is reading.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
  })
}

export const useCancelLinkDeviceMutation = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const navigate = useNavigate()

  return useMutation({
    mutationKey: ['cancel', 'linkDevice'],
    mutationFn: async (accountId: string) => {
      const token = localStorage.getItem('importToken')
      await axios.post(
        '/auth/link/cancel',
        { accountId },
        { headers: { Authorization: `Bearer ${token}` }, baseURL: apiUrl },
      )
    },
    onSuccess: () => {
      navigate('/login')
    },
    onError: () => {
      setAlertContent({ messageI18nKey: 'unknown_error_alert', severity: 'error', alertOpen: true })
      navigate('/login')
    },
  })
}

export const useSetPasswordMutation = (accountId: string) => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const cancelLinkDeviceMutation = useCancelLinkDeviceMutation()
  const navivate = useNavigate()
  return useMutation({
    mutationKey: ['user', 'setPassword'],
    mutationFn: async (password: string) => {
      const token = localStorage.getItem('importToken')
      const response = await axios.post(
        '/auth/link/password',
        { password, accountId },
        { headers: { Authorization: `Bearer ${token}` }, baseURL: apiUrl },
      )
      return response
    },
    onSuccess: (response) => {
      setAccessToken(response.data.accessToken)
      localStorage.removeItem('importToken')
      navivate('/')
    },
    onError: (e: any) => {
      if (e.response.status === HttpStatusCode.NotFound) {
        // the user has not username
        setAlertContent({
          messageI18nKey: 'password_setter_request_failed_not_found',
          severity: 'error',
          alertOpen: true,
        })
        cancelLinkDeviceMutation.mutate(accountId)
        localStorage.removeItem('importToken')
        navivate('/')
        return
      }
      setAlertContent({ messageI18nKey: 'password_setter_request_failed', severity: 'error', alertOpen: true })
    },
  })
}
