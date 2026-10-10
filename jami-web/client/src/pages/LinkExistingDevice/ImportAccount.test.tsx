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
import { ThemeProvider } from '@mui/material/styles'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../themes/Default.js'
import ImportAccount from './ImportAccount.js'

const { setWebSocketToken, setImportToken, refetch, linkTokenQuery, importDeviceContext, webSocketToken } = vi.hoisted(
  () => ({
    setWebSocketToken: vi.fn(),
    setImportToken: vi.fn(),
    refetch: vi.fn(),
    linkTokenQuery: {
      value: {
        data: { jwt: 'ws-jwt', details: { token: 'jami-auth://code' } } as unknown,
        isLoading: false,
        isPending: false,
        isError: false,
        refetch: undefined as unknown,
      },
    },
    importDeviceContext: { value: { token: '' } },
    webSocketToken: { value: undefined as string | undefined },
  }),
)

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../contexts/ImportDeviceProvider.js', () => ({
  useImportDeviceContext: () => ({ ...importDeviceContext.value, setToken: setImportToken }),
}))
vi.mock('../../contexts/WebSocketLinkProvider.js', () => ({
  useWebSocketLinkContext: () => ({ setToken: setWebSocketToken, token: webSocketToken.value }),
}))
vi.mock('../../services/authQueries.js', () => ({
  useGetLinkTokenQuery: () => linkTokenQuery.value,
}))
vi.mock('../../components/UnconnectedUserLayout.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const renderPage = () =>
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <ImportAccount />
    </ThemeProvider>,
  )

describe('ImportAccount', () => {
  beforeEach(() => {
    setWebSocketToken.mockClear()
    setImportToken.mockClear()
    refetch.mockClear()
    linkTokenQuery.value = {
      data: { jwt: 'ws-jwt', details: { token: 'jami-auth://code' } },
      isLoading: false,
      isPending: false,
      isError: false,
      refetch,
    }
    importDeviceContext.value = { token: '' }
    webSocketToken.value = undefined
    localStorage.clear()
  })

  it('opens the link websocket with the freshly issued token', () => {
    renderPage()

    expect(setWebSocketToken).toHaveBeenCalledWith('ws-jwt')
    expect(setImportToken).toHaveBeenCalledWith('jami-auth://code')
  })

  it('does not reopen the websocket once it is connected', () => {
    webSocketToken.value = 'ws-jwt'
    importDeviceContext.value = { token: 'jami-auth://code' }

    renderPage()

    expect(setWebSocketToken).not.toHaveBeenCalled()
    expect(screen.getByText('jami-auth://code')).toBeInTheDocument()
  })

  it('reports a failure to obtain a link code instead of showing an empty screen', () => {
    linkTokenQuery.value = { data: undefined, isLoading: false, isPending: false, isError: true, refetch: refetch }

    renderPage()

    expect(screen.getByAltText('')).toHaveAttribute('src', '/jami-failure.svg')
    expect(screen.getByText('link_device_could_not_initiate')).toBeInTheDocument()
  })

  it('lets the user ask for a new link code after a failure', () => {
    linkTokenQuery.value = { data: undefined, isLoading: false, isPending: false, isError: true, refetch: refetch }

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))

    expect(refetch).toHaveBeenCalled()
  })
})
