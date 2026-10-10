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
import { ThemeProvider } from '@mui/material'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../../../themes/Default.js'
import CustomizeProfile from './CustomizeProfile.js'

const mutations = vi.hoisted(() => ({
  removeAvatar: vi.fn(),
  resetDisplayName: vi.fn(),
  setDisplayName: vi.fn(),
  updateAvatar: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../../../components/ConversationAvatar.js', () => ({
  AvatarEditor: ({ onAvatarChange }: { onAvatarChange: (avatar: File) => void }) => (
    <button onClick={() => onAvatarChange(new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' }))}>
      select-avatar
    </button>
  ),
}))
vi.mock('../../../contexts/AuthProvider.js', () => ({
  useAuthContext: () => ({
    account: {
      getDisplayName: () => 'Current name',
      getRegisteredName: () => 'Current name',
    },
  }),
}))
vi.mock('../../../services/accountQueries.js', () => ({
  useRemoveAvatarMutation: () => ({ isPending: false, mutateAsync: mutations.removeAvatar }),
  useResetDisplayName: () => ({ mutate: mutations.resetDisplayName }),
  useSetDisplayName: () => ({ isPending: false, mutateAsync: mutations.setDisplayName }),
  useUpdateAvatarMutation: () => ({ isPending: false, mutateAsync: mutations.updateAvatar }),
}))
vi.mock('../SettingsPage.js', () => ({
  SettingsSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

function renderCustomizeProfile() {
  render(
    <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
      <CustomizeProfile />
    </ThemeProvider>,
  )
}

describe('CustomizeProfile', () => {
  beforeEach(() => {
    mutations.removeAvatar.mockReset().mockResolvedValue(undefined)
    mutations.resetDisplayName.mockReset()
    mutations.setDisplayName.mockReset().mockResolvedValue(undefined)
    mutations.updateAvatar.mockReset().mockResolvedValue(undefined)
  })

  it('keeps Save disabled until a profile field changes', async () => {
    const user = userEvent.setup()
    renderCustomizeProfile()

    const saveButton = screen.getByRole('button', { name: 'save_button' })
    expect(saveButton).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'settings_display_name' }), ' updated')
    expect(saveButton).toBeEnabled()
  })

  it('updates only the changed display name', async () => {
    const user = userEvent.setup()
    renderCustomizeProfile()

    await user.type(screen.getByRole('textbox', { name: 'settings_display_name' }), ' updated')
    await user.click(screen.getByRole('button', { name: 'save_button' }))

    await waitFor(() => expect(mutations.setDisplayName).toHaveBeenCalledWith('Current name updated'))
    expect(mutations.updateAvatar).not.toHaveBeenCalled()
  })

  it('updates only the selected avatar', async () => {
    const user = userEvent.setup()
    renderCustomizeProfile()

    await user.click(screen.getByRole('button', { name: 'select-avatar' }))
    await user.click(screen.getByRole('button', { name: 'save_button' }))

    await waitFor(() => expect(mutations.updateAvatar).toHaveBeenCalledTimes(1))
    expect(mutations.updateAvatar.mock.calls[0][0].get('avatar')).toBeInstanceOf(File)
    expect(mutations.setDisplayName).not.toHaveBeenCalled()
  })

  it('still updates the display name when the avatar update fails', async () => {
    const user = userEvent.setup()
    mutations.updateAvatar.mockRejectedValueOnce(new Error('upload failed'))
    renderCustomizeProfile()

    await user.type(screen.getByRole('textbox', { name: 'settings_display_name' }), ' updated')
    await user.click(screen.getByRole('button', { name: 'select-avatar' }))
    await user.click(screen.getByRole('button', { name: 'save_button' }))

    await waitFor(() => expect(mutations.setDisplayName).toHaveBeenCalledWith('Current name updated'))
    await waitFor(() => expect(mutations.updateAvatar).toHaveBeenCalledTimes(1))
  })
})
