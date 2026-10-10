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
import CallIcon from '@mui/icons-material/Call'
import CallEndIcon from '@mui/icons-material/CallEnd'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'

import FilledIconButton from './FilledIconButton.js'

const meta = {
  title: 'Design system/FilledIconButton',
  component: FilledIconButton,
  args: {
    'aria-label': 'Accept the call',
    tooltip: 'Accept the call',
    children: <CallIcon />,
    disabled: false,
  },
} satisfies Meta<typeof FilledIconButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/**
 * The fill comes from a palette colour rather than a literal, so the glyph always sits on the
 * contrast text that palette entry defines. Accept and decline are the pair this exists for.
 */
export const CallActions: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2}>
      <FilledIconButton
        {...args}
        aria-label="Accept the call"
        tooltip="Accept the call"
        paletteColor={(theme) => theme.palette.success}
      >
        <CallIcon />
      </FilledIconButton>
      <FilledIconButton
        {...args}
        aria-label="Decline the call"
        tooltip="Decline the call"
        paletteColor={(theme) => theme.palette.error}
      >
        <CallEndIcon />
      </FilledIconButton>
    </Stack>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}
