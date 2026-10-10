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
import { describe, expect, it, vi } from 'vitest'

import { refreshContactProfile } from './AccountDetailsListener.js'

describe('refreshContactProfile', () => {
  it('refreshes contact details alongside the profile picture', () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
      removeQueries: vi.fn(),
      refetchQueries: vi.fn(),
      setQueryData: vi.fn(),
    }

    refreshContactProfile(queryClient, 'contact-uri', 'Ada Lovelace')

    expect(queryClient.setQueryData).toHaveBeenCalledWith(['contacts', 'contact-uri'], expect.any(Function))
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['picture', 'contact-uri'] })
    expect(queryClient.removeQueries).toHaveBeenCalledWith({ queryKey: ['picture', 'contact-uri'] })
    expect(queryClient.refetchQueries).toHaveBeenCalledWith({ queryKey: ['picture', 'contact-uri'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['contacts', 'contact-uri'] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['contact', 'list'] })
  })
})
