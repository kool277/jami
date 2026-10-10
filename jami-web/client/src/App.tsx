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
import './dayjsInitializer.js' // Initialized once and globally to ensure available locales are always imported

import axios from 'axios'
import { lazy, Suspense, useState } from 'react'
import { LoaderFunctionArgs, Outlet, redirect, useLocation } from 'react-router-dom'

import { InviteDetailSkeletonContent } from './components/common/InviteDetailSkeleton.js'
import LoadingSkeleton from './components/common/LoadingSkeleton.js'
import { getAccessToken, setAccessToken } from './services/authQueries.js'
import { apiUrl } from './utils/constants.js'
import { isElectronMode } from './utils/electron.js'
import { isRoutePathActive } from './utils/routes.js'

const WelcomeAnimation = lazy(() => import('./components/WelcomeAnimation.js'))

export async function appLoader({ request }: LoaderFunctionArgs) {
  const initialUrl = new URL(request.url)
  const electronMode = isElectronMode()
  const path = initialUrl.pathname

  // In Electron mode, admin setup is bypassed and auto-login is attempted
  if (electronMode) {
    // If user is navigating to admin panel, let them through
    if (path.startsWith('/admin')) {
      return null
    }

    // If already authenticated, proceed normally
    if (getAccessToken()) {
      return null
    }

    // Try auto-login: fetch local accounts and login to the first one
    try {
      const { data } = await axios.get<{
        accounts: Array<{ id: string; registeredName: string; displayName: string }>
      }>('/auth/local-accounts', { baseURL: apiUrl })
      if (data.accounts.length >= 1) {
        const lastUsedId = localStorage.getItem('lastLoginAccountId')
        const target = (lastUsedId && data.accounts.find((a) => a.id === lastUsedId)) || data.accounts[0]
        const { data: loginData } = await axios.post(
          '/auth/switch-account',
          { accountId: target.id },
          { baseURL: apiUrl },
        )
        setAccessToken(loginData.accessToken)
        localStorage.setItem('lastLoginAccountId', target.id)
        return redirect('/conversation')
      }
      // No accounts: send to registration
    } catch {
      // Auto-login failed, fall through to normal routing
    }

    return null
  }

  return null
}

const App = () => {
  const [displayWelcome, setDisplayWelcome] = useState<boolean>(() => getAccessToken() === undefined)
  const { pathname } = useLocation()
  const isAdmin = isRoutePathActive(pathname, '/admin')
  const isInvites = isRoutePathActive(pathname, '/invites')
  const isSettings = isRoutePathActive(pathname, '/settings')
  const contentIsland = isAdmin || isInvites || isSettings || /^\/conversation\/[^/]+(?:\/|$)/.test(pathname)

  if (displayWelcome) {
    return (
      <Suspense fallback={<LoadingSkeleton fullPage />}>
        <WelcomeAnimation onComplete={() => setDisplayWelcome(false)} />
      </Suspense>
    )
  }

  return (
    <Suspense
      fallback={
        <LoadingSkeleton
          fullPage
          contentIsland={contentIsland}
          content={isInvites ? <InviteDetailSkeletonContent /> : undefined}
          navigation={isSettings ? 'settings' : undefined}
        />
      }
    >
      <Outlet />
    </Suspense>
  )
}

export default App
