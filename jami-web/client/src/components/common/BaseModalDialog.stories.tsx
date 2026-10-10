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
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import Typography from '@mui/material/Typography'
import type { Meta, StoryObj } from '@storybook/react-vite'

import BaseButton from './BaseButton.js'
import BaseModalDialog from './BaseModalDialog.js'

const meta = {
  title: 'Design system/BaseModalDialog',
  component: BaseModalDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    selectedValue: '',
    title: 'Delete this conversation?',
    onClose: () => {},
    children: (
      <Typography variant="body1">
        The conversation and everything in it is removed from this device. This cannot be undone.
      </Typography>
    ),
  },
} satisfies Meta<typeof BaseModalDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const WithActions: Story = {
  args: {
    actions: (
      <>
        <BaseButton variant="text">Cancel</BaseButton>
        <BaseButton variant="contained">Delete</BaseButton>
      </>
    ),
  },
}

export const WithTitleIcon: Story = {
  args: {
    titleIcon: <WarningAmberIcon color="error" />,
  },
}

/**
 * A dialog with no visible title still needs an accessible name, so the type demands either
 * `title` or `aria-label`. Inspect the element to see `aria-label` standing in for the heading.
 */
export const WithoutVisibleTitle: Story = {
  args: {
    title: undefined,
    'aria-label': 'Delete this conversation?',
  },
}

/**
 * The close policy decides which gestures dismiss the dialog. `'none'` means the user has to pick
 * one of the actions — press Escape and click the backdrop to confirm nothing happens.
 */
export const NotDismissible: Story = {
  args: {
    closePolicy: 'none',
    actions: <BaseButton variant="contained">Understood</BaseButton>,
  },
}
