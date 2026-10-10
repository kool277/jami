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
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'

import NavItem from './NavItem.js'
import NavRail from './NavRail.js'

const meta = {
  title: 'Design system/NavRail',
  component: NavRail,
  args: {
    inviteCount: 2,
    unreadConversationCount: 5,
    accountSlot: <NavItem label="Account" icon={<Avatar sx={{ width: 32, height: 32 }}>A</Avatar>} />,
  },
  argTypes: {
    accountSlot: { control: false },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/conversation']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof NavRail>

export default meta

type Story = StoryObj<typeof meta>

export const Rail: Story = {
  render: (args) => (
    <Box sx={{ display: 'flex', height: 400, alignItems: 'stretch' }}>
      <NavRail {...args} />
    </Box>
  ),
}

export const BottomBar: Story = {
  args: {
    compact: true,
    accountSlot: <NavItem compact label="Account" icon={<Avatar sx={{ width: 32, height: 32 }}>A</Avatar>} />,
  },
  render: (args) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 400, width: 360 }}>
      <NavRail {...args} />
    </Box>
  ),
}
