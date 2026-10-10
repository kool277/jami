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
import { Box } from '@mui/material'
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { CustomThemeContext } from '../../contexts/CustomThemeProvider.js'
import { type IImportDeviceContext, ImportDeviceContext } from '../../contexts/ImportDeviceProvider.js'
import { WebSocketLinkContext } from '../../contexts/WebSocketLinkProvider.js'
import { WithChildren } from '../../utils/utils.js'

/** A code in the shape the daemon issues, so the QR code and the truncation behave realistically. */
export const SAMPLE_LINK_TOKEN = 'jami-auth://7aec7b29bc35e442047ee217f14b04915ab9d74188e95e7ceddb718286fde935/970602'

export const SAMPLE_ACCOUNT_ID = '6de327dc79c5c987'
export const SAMPLE_PEER_ID = '761ee5cca44191c6f4649d78fa5910440edce697'
export const SAMPLE_PEER_DEVICE_ID = '1710b3b1556d555911a4d976acb2d5d3879cbfe8'

export interface LinkFlowHarnessProps extends WithChildren {
  /** The step the flow is stopped at, which is what each page renders against. */
  state?: DeviceAuthStateCode
  /** The daemon payload for the step, e.g. auth_scheme, peer_id or auth_error. */
  details?: Record<string, string>
  /** Set to '' to render the guard sending the user back home. */
  token?: string
  /**
   * Seeds the answer to /auth/link-token. The query never refetches, so seeding the cache keeps
   * the page off the network entirely. Leave undefined to render the failure state.
   */
  linkTokenData?: unknown
  /** Seeds a failed /auth/link-token, without depending on a server being unreachable. */
  linkTokenFailed?: boolean
}

/**
 * Renders a step of the device linking flow without a daemon, a server or a peer device.
 *
 * The flow is normally driven by websocket events from the daemon, so a step is only reachable by
 * performing the whole link on two devices. Every page reads its step from context and its data
 * from the query cache, so both can be handed over directly.
 */
export const LinkFlowHarness = ({
  state = DeviceAuthStateCode.TokenAvailable,
  details = {},
  token = SAMPLE_LINK_TOKEN,
  linkTokenData,
  linkTokenFailed = false,
  children,
}: LinkFlowHarnessProps) => {
  // Rebuilding the client on every render would throw the seeded cache away.
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      // retryOnMount would immediately refetch a seeded failure and put the story back on the wire.
      defaultOptions: { queries: { retry: false, retryOnMount: false }, mutations: { retry: false } },
    })
    if (linkTokenData !== undefined) {
      client.setQueryData(['linkToken'], linkTokenData)
    }
    if (linkTokenFailed) {
      // Seeding a settled failure keeps the story deterministic, rather than relying on the request
      // happening to fail because no server is around.
      client
        .getQueryCache()
        .build(client, { queryKey: ['linkToken'] })
        .setState({
          status: 'error',
          fetchStatus: 'idle',
          error: new Error('Link token unavailable'),
          errorUpdatedAt: Date.now(),
        })
    }
    return client
  })

  const importDevice: IImportDeviceContext = useMemo(
    () => ({
      accountId: SAMPLE_ACCOUNT_ID,
      state,
      token,
      details: new Map(Object.entries(details)),
      setToken: () => undefined,
    }),
    [state, token, details],
  )

  const webSocketLink = useMemo(
    () => ({
      bind: () => undefined,
      unbind: () => undefined,
      send: () => false,
      setToken: () => undefined,
      token: 'story-websocket-token',
    }),
    [],
  )
  const customTheme = useMemo(
    () => ({
      mode: 'light' as const,
      toggleMode: () => undefined,
      animationsEnabled: true,
      toggleAnimations: () => undefined,
    }),
    [],
  )

  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <CustomThemeContext value={customTheme}>
          <WebSocketLinkContext value={webSocketLink as never}>
            <ImportDeviceContext value={importDevice}>
              {/*
               * The pages size themselves against a full-viewport ancestor, which the application
               * root provides but a story root does not, so the layout would otherwise collapse to
               * the height of its own content and push the card out of view.
               */}
              <Box sx={{ height: '100vh', width: '100%', overflow: 'hidden' }}>{children}</Box>
            </ImportDeviceContext>
          </WebSocketLinkContext>
        </CustomThemeContext>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

/** Story decorator form, for pages that need no per-story flow data. */
export const withLinkFlow =
  (props: Omit<LinkFlowHarnessProps, 'children'> = {}) =>
  (Story: React.ComponentType) => (
    <LinkFlowHarness {...props}>
      <Story />
    </LinkFlowHarness>
  )
