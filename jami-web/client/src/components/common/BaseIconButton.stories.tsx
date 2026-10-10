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
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CallIcon from '@mui/icons-material/Call'
import VideocamIcon from '@mui/icons-material/Videocam'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'

import BaseIconButton from './BaseIconButton.js'

const meta = {
  title: 'Design system/BaseIconButton',
  component: BaseIconButton,
  args: {
    'aria-label': 'Start audio call',
    tooltip: 'Start audio call',
    children: <CallIcon />,
    disabled: false,
  },
  argTypes: {
    color: { control: 'inline-radio', options: ['default', 'primary', 'secondary', 'error'] },
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
  },
} satisfies Meta<typeof BaseIconButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Sizes: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <BaseIconButton {...args} size="small" />
      <BaseIconButton {...args} size="medium" />
      <BaseIconButton {...args} size="large" />
    </Stack>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}

// Directional icons must mirror in right-to-left locales; switch the Direction toolbar to verify.
export const DirectionalIcon: Story = {
  args: {
    'aria-label': 'Next step',
    tooltip: 'Next step',
    children: <ArrowForwardIcon />,
  },
}

export const CallActions: Story = {
  render: (args) => (
    <Stack direction="row" spacing={1}>
      <BaseIconButton {...args} aria-label="Start audio call" tooltip="Start audio call">
        <CallIcon />
      </BaseIconButton>
      <BaseIconButton {...args} aria-label="Start video call" tooltip="Start video call">
        <VideocamIcon />
      </BaseIconButton>
    </Stack>
  ),
}
