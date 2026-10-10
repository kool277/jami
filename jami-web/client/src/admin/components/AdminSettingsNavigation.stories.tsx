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

import AdminSettingsNavigation from './AdminSettingsNavigation.js'

const meta = {
  title: 'Admin/Settings navigation',
  component: AdminSettingsNavigation,
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', width: 320, height: 560, backgroundColor: 'background.paper' }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof AdminSettingsNavigation>

export default meta

type Story = StoryObj<typeof meta>

export const ConfigurationSelected: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/admin/configuration/account']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export const NestedOpenIdProviderSelected: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/admin/authentication/openid/google']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}
