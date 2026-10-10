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

import { MailIcon } from '../SvgIcon.js'
import ListPaneEmptyState from './ListPaneEmptyState.js'

const meta = {
  title: 'Design system/List pane empty state',
  component: ListPaneEmptyState,
  args: {
    icon: <MailIcon sx={{ color: 'text.secondary', fontSize: 48 }} />,
    title: 'No invitations',
    description: 'New conversation invitations will appear here.',
  },
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', width: 320, height: 480, backgroundColor: 'background.paper' }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof ListPaneEmptyState>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
