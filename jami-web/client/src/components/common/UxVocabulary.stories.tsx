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
import InboxIcon from '@mui/icons-material/Inbox'
import RefreshIcon from '@mui/icons-material/Refresh'
import { IconButton, Stack } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'

import EmptyState from './EmptyState.js'
import ErrorBanner from './ErrorBanner.js'
import LoadingSkeleton from './LoadingSkeleton.js'

const meta = {
  title: 'Design system/UX vocabulary',
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={<InboxIcon color="disabled" fontSize="large" />}
      title="No messages yet"
      description="Start the conversation by sending a message."
    />
  ),
}

export const Loading: Story = {
  render: () => <LoadingSkeleton />,
}

export const Error: Story = {
  render: () => (
    <ErrorBanner
      title="Could not load messages"
      action={
        <IconButton aria-label="Retry loading messages">
          <RefreshIcon />
        </IconButton>
      }
    >
      Check your connection and try again.
    </ErrorBanner>
  ),
}

export const StatesTogether: Story = {
  render: () => (
    <Stack spacing={3}>
      <LoadingSkeleton lines={2} />
      <ErrorBanner title="Could not load messages">Check your connection and try again.</ErrorBanner>
      <EmptyState
        icon={<InboxIcon color="disabled" fontSize="large" />}
        title="No messages yet"
        description="Start the conversation by sending a message."
      />
    </Stack>
  ),
}
