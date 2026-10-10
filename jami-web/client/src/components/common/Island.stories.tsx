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
import { Box, Typography } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'

import Island from './Island.js'

const meta = {
  title: 'Design system/Island',
  component: Island,
  args: {
    children: <Typography sx={{ p: 2 }}>Island content</Typography>,
  },
  decorators: [
    (Story) => (
      <Box sx={{ backgroundColor: 'background.default', p: 3, width: 420 }}>
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof Island>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
