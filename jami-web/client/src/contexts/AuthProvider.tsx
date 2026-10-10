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
import { HttpStatusCode, IAccount } from '@savoirfairelinux/jami-web-common'
import axios, { AxiosInstance } from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ProcessingRequest from '../components/ProcessingRequest.js'
import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { Account } from '../models/account.js'
import { apiUrl } from '../utils/constants.js'
import { isElectronMode } from '../utils/electron.js'
import { WithChildren } from '../utils/utils.js'

interface IAuthContext {
  token: string
  account: Account
  accountId: string
  logout: () => void
  switchAccount: (newToken: string) => void
  axiosInstance: AxiosInstance
  updateDevices: (devices: IAccount['devices']) => void
}

const optionalAuthContext = createOptionalContext<IAuthContext>('AuthContext')
const AuthContext = optionalAuthContext.Context
export const useAuthContext = optionalAuthContext.useOptionalContext

export default ({ children }: WithChildren) => {
  const [token, setToken] = useState<string | undefined>(() => localStorage.getItem('accessToken') ?? undefined)
  const [account, setAccount] = useState<Account | undefined>()
  const navigate = useNavigate()

  const updateDevices = useCallback((devices: IAccount['devices']) => {
    setAccount((prev) => {
      if (!prev) {
        return undefined
      }

      prev.setDevices(devices)
      return prev
    })
  }, [])

  const redirectToLogin = useCallback(() => {
    navigate(isElectronMode() ? '/register' : '/login')
  }, [navigate])

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken')
    setAccount(undefined)
    setToken(undefined)
    redirectToLogin()
  }, [redirectToLogin])

  const switchAccount = useCallback((newToken: string) => {
    localStorage.setItem('accessToken', newToken)
    setAccount(undefined)
    setToken(newToken)
  }, [])

  const axiosInstance = useMemo(() => {
    if (!token) {
      return
    }

    const instance = axios.create({
      baseURL: apiUrl,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    instance.interceptors.response.use(
      (res) => res,
      (e) => {
        switch (e.response?.status) {
          case HttpStatusCode.Unauthorized:
            logout()
            break
        }
        throw e
      },
    )

    return instance
  }, [token, logout])

  useEffect(() => {
    if (!token) {
      console.warn('Missing authentication JWT. Redirecting to login page...')
      redirectToLogin()
    }
  }, [redirectToLogin, token])

  useEffect(() => {
    if (!axiosInstance) {
      return
    }

    axiosInstance.get<IAccount>('/account').then(({ data }) => setAccount(Account.fromInterface(data)))
  }, [axiosInstance, logout])

  const value = useMemo(() => {
    if (!token || !account || !axiosInstance) {
      return
    }

    return {
      token,
      logout,
      switchAccount,
      account,
      accountId: account.id,
      axiosInstance,
      updateDevices,
    }
  }, [token, logout, switchAccount, account, axiosInstance, updateDevices])

  if (!value) {
    return <ProcessingRequest open />
  }

  return <AuthContext value={value}>{children}</AuthContext>
}
