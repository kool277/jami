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
import type { Meta, StoryObj } from '@storybook/react-vite'

import ConfirmDialog from './ConfirmDialog.js'

const meta = {
  title: 'Design system/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: true,
    title: 'Delete conversation?',
    description: 'This permanently removes the conversation from this device.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    destructive: true,
    onConfirm: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof ConfirmDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Destructive: Story = {}

export const NonDestructive: Story = {
  args: {
    title: 'Leave conversation?',
    description: 'You can join again if another member invites you.',
    confirmLabel: 'Leave',
    destructive: false,
  },
}
