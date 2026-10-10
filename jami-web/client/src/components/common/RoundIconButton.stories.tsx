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
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'

import RoundIconButton from './RoundIconButton.js'

const meta = {
  title: 'Design system/RoundIconButton',
  component: RoundIconButton,
  args: {
    'aria-label': 'Add a picture',
    tooltip: 'Add a picture',
    children: <AddIcon fontSize="inherit" />,
    disabled: false,
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
  },
} satisfies Meta<typeof RoundIconButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

// The outline is fixed at 1px across all three, so the glyph has to scale with the target.
export const Sizes: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <RoundIconButton {...args} size="small" />
      <RoundIconButton {...args} size="medium" />
      <RoundIconButton {...args} size="large" />
    </Stack>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const AvatarControls: Story = {
  render: (args) => (
    <Stack direction="row" spacing={1}>
      <RoundIconButton {...args} aria-label="Add a picture" tooltip="Add a picture">
        <AddIcon fontSize="inherit" />
      </RoundIconButton>
      <RoundIconButton {...args} aria-label="Change the picture" tooltip="Change the picture">
        <EditIcon fontSize="inherit" />
      </RoundIconButton>
    </Stack>
  ),
}
