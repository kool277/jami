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
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { useImportDeviceContext } from '../../contexts/ImportDeviceProvider.js'

const routeForState: Partial<Record<DeviceAuthStateCode, string>> = {
  [DeviceAuthStateCode.Connecting]: '/import-account-connecting',
  [DeviceAuthStateCode.Authenticating]: '/import-account-unlock',
  [DeviceAuthStateCode.InProgress]: '/import-account-in-progress',
  [DeviceAuthStateCode.Done]: '/import-account-done',
}

/**
 * Keeps an import step in sync with the flow state: pages of the import flow are only reachable
 * while their own step is active, so a stale page redirects to the page matching the current state.
 */
export const useImportFlowGuard = (expectedState: DeviceAuthStateCode) => {
  const { state, token } = useImportDeviceContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }

    if (state === expectedState) {
      return
    }

    navigate(routeForState[state] ?? '/')
  }, [expectedState, navigate, state, token])
}
