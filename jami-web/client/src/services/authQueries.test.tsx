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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGetLinkTokenQuery } from './authQueries.js'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('axios', () => ({ default: { get } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const renderQuery = (queryClient: QueryClient) =>
  renderHook(() => useGetLinkTokenQuery(), {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  })

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('useGetLinkTokenQuery', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { jwt: 'ws-jwt', details: { token: 'jami-auth://code' } } })
    localStorage.clear()
  })

  it('stores the temporary token issued with the link token', async () => {
    const { result } = renderQuery(newQueryClient())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(localStorage.getItem('importToken')).toBe('ws-jwt')
  })

  it('keeps the issued token when the page remounts', async () => {
    const queryClient = newQueryClient()
    const first = renderQuery(queryClient)
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    // Remounting must not start a second link operation on the daemon, which would
    // leave the first dangling and swap the code out from under the user.
    const second = renderQuery(queryClient)
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(get).toHaveBeenCalledTimes(1)
    expect(second.result.current.data.details.token).toBe('jami-auth://code')
  })

  it('does not start a new link operation when the window regains focus', async () => {
    const { result } = renderQuery(newQueryClient())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    window.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1))
  })
})
