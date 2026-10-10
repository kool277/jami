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
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { refreshProfilePicture } from './accountQueries.js'

describe('refreshProfilePicture', () => {
  it('revokes the preview and refetches the persisted picture', async () => {
    const queryClient = new QueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async () => {
      queryClient.setQueryData(['picture', 'account-uri'], 'blob:persisted')
    })
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    queryClient.setQueryData(['picture', 'account-uri'], 'blob:preview')

    await refreshProfilePicture(queryClient, 'account-uri')

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['picture', 'account-uri'],
      refetchType: 'active',
    })
    expect(queryClient.getQueryData(['picture', 'account-uri'])).toBe('blob:persisted')
  })
})
