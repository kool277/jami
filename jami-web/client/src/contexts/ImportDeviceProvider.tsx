/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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
  DeviceAuthError,
  DeviceAuthStateChanged,
  DeviceAuthStateCode,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import { use, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { WithChildren } from '../utils/utils.js'
import { AlertSnackbarContext } from './AlertSnackbarProvider.js'
import { useWebSocketLinkContext } from './WebSocketLinkProvider.js'

export interface IImportDeviceContext {
  accountId: string
  state: DeviceAuthStateCode
  token: string
  details: Map<string, string>
  setToken: (token: string) => void
}
const optionalImportDeviceContext = createOptionalContext<IImportDeviceContext>('ImportDeviceContext')
export const ImportDeviceContext = optionalImportDeviceContext.Context
export const useImportDeviceContext = optionalImportDeviceContext.useOptionalContext

const ImportDeviceProvider: React.FC<WithChildren> = ({ children }) => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const navigate = useNavigate()
  const webSocket = useWebSocketLinkContext()
  const [accountId, setAccountId] = useState<string>('')
  const [state, setState] = useState<DeviceAuthStateCode>(DeviceAuthStateCode.Init)
  const [token, setToken] = useState<string>('')
  const [details, setDetails] = useState<Map<string, string>>(() => new Map())
  const lastStateRef = useRef<DeviceAuthStateCode>(DeviceAuthStateCode.Init)

  useEffect(() => {
    function handleDeviceAuth(data: DeviceAuthStateChanged) {
      const details = new Map(Object.entries(data.details ?? {}))
      const error = details.get('error')
      // A terminal error ends the operation, so the next attempt legitimately starts over from a lower state.
      const isFailure =
        data.state === DeviceAuthStateCode.Done && error !== undefined && error !== DeviceAuthError.Success

      if (data.state <= lastStateRef.current && !isFailure) {
        return
      }
      lastStateRef.current = isFailure ? DeviceAuthStateCode.Init : data.state

      setAccountId((previous) => previous || data.accountId)
      setState(data.state)
      if (
        data.state !== DeviceAuthStateCode.Init &&
        data.state !== DeviceAuthStateCode.Connecting &&
        data.state !== DeviceAuthStateCode.InProgress
      ) {
        setDetails(details)
      }
      switch (data.state) {
        case DeviceAuthStateCode.Connecting:
          navigate('/import-account-connecting')
          break
        case DeviceAuthStateCode.Authenticating:
          // if the user has a password we need to ask for the password
          // if a password is set
          navigate('/import-account-unlock')
          break
        case DeviceAuthStateCode.InProgress:
          // the user has confirmed on the old device now
          navigate('/import-account-in-progress')
          break
        case DeviceAuthStateCode.Done:
          // help the user create a password for the server web
          // verify that the status is not errored else, we have to restart the process
          if (!isFailure) {
            navigate('/import-account-done')
            break
          }

          setState(DeviceAuthStateCode.Init)
          setAlertContent({
            messageI18nKey:
              error === DeviceAuthError.Authentication
                ? 'device_auth_error_authentication'
                : error === DeviceAuthError.Network
                  ? 'device_auth_error_network'
                  : 'unknown_error_alert',
            severity: 'error',
            alertOpen: true,
          })
          navigate('/import-account')
      }
    }
    webSocket.bind(WebSocketMessageType.DeviceAuthStateChanged, handleDeviceAuth)
    return () => {
      webSocket.unbind(WebSocketMessageType.DeviceAuthStateChanged, handleDeviceAuth)
    }
  }, [navigate, setAlertContent, webSocket])

  const value = useMemo(
    () => ({
      details,
      state,
      accountId,
      token,
      setToken,
      setAccountId,
    }),
    [accountId, details, state, token],
  )

  return <ImportDeviceContext value={value}>{children}</ImportDeviceContext>
}

export default ImportDeviceProvider
