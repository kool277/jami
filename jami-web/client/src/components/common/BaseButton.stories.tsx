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
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'

import BaseButton from './BaseButton.js'

const meta = {
  title: 'Design system/BaseButton',
  component: BaseButton,
  args: {
    children: 'Send message',
    variant: 'contained',
    disabled: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['contained', 'outlined', 'text'] },
    color: { control: 'inline-radio', options: ['primary', 'secondary', 'error'] },
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
  },
} satisfies Meta<typeof BaseButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Variants: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2}>
      <BaseButton {...args} variant="contained" />
      <BaseButton {...args} variant="outlined" />
      <BaseButton {...args} variant="text" />
    </Stack>
  ),
}

export const Sizes: Story = {
  render: (args) => (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <BaseButton {...args} size="small" />
      <BaseButton {...args} size="medium" />
      <BaseButton {...args} size="large" />
    </Stack>
  ),
}

export const Disabled: Story = {
  args: { disabled: true },
}

export const LongLabel: Story = {
  args: { children: 'Export this account to another device and keep it synchronised' },
}
