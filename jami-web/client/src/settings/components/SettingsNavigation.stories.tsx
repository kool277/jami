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
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'

import SettingsNavigation from './SettingsNavigation.js'

const meta = {
  title: 'Settings/Navigation',
  component: SettingsNavigation,
} satisfies Meta<typeof SettingsNavigation>

export default meta

type Story = StoryObj<typeof meta>

const renderAt = (path: string) => () => (
  <Box sx={{ width: 320, backgroundColor: 'background.paper' }}>
    <MemoryRouter initialEntries={[path]}>
      <SettingsNavigation />
    </MemoryRouter>
  </Box>
)

export const GeneralSelected: Story = {
  render: renderAt('/settings/general/system'),
}

export const AccountSelected: Story = {
  render: renderAt('/settings/account/manage-account'),
}

export const NestedAccountRouteSelected: Story = {
  render: renderAt('/settings/account/linked-devices/export'),
}
