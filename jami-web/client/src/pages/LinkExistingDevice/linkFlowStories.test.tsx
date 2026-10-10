/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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
import { composeStories } from '@storybook/react-vite'
import { render, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'

import * as importAccount from './ImportAccount.stories.js'
import * as confirmation from './ImportAccountConfirmation.stories.js'
import * as connecting from './ImportAccountConnecting.stories.js'
import * as lock from './ImportAccountLock.stories.js'
import * as transfer from './ImportAccountTransferInProgress.stories.js'

vi.mock('../../components/JamiWelcomeLogo.js', () => ({ default: () => <div>Jami logo</div> }))

interface StoryGroup {
  name: string
  storyModule: object
  expectedContent: Record<string, string>
}

/**
 * The stories are the only way the link flow steps can be looked at without two devices, so a
 * story that silently renders nothing would hand back a blank page instead of a screen to work on.
 */
describe.each<StoryGroup>([
  {
    name: 'ImportAccount',
    storyModule: importAccount,
    expectedContent: {
      CodeIssued: 'jami-auth://7aec7b29bc35e442047ee217f14b04915ab9d74188e95e7ceddb718286fde935/970602',
      CouldNotGetACode: 'An error occurred while linking the device. Please try again.',
    },
  },
  {
    name: 'ImportAccountConnecting',
    storyModule: connecting,
    expectedContent: {
      Waiting: 'Please confirm account on the source device.',
    },
  },
  {
    name: 'ImportAccountLock',
    storyModule: lock,
    expectedContent: {
      PasswordProtected: 'Password',
      NoPassword: 'Confirm connection',
      RejectedPassword: 'Incorrect password',
      UnknownPeer: 'Unknown',
    },
  },
  {
    name: 'ImportAccountTransferInProgress',
    storyModule: transfer,
    expectedContent: {
      Transferring: 'Account importing in progress',
    },
  },
  {
    name: 'ImportAccountConfirmation',
    storyModule: confirmation,
    expectedContent: {
      Imported: 'The account was imported successfully.',
      SetAPassword: 'Create a password for the online account.',
    },
  },
])('$name stories', ({ storyModule, expectedContent }) => {
  const stories = composeStories(storyModule as never) as unknown as Record<string, ComponentType>

  it.each(Object.keys(stories))('%s renders its expected state', async (storyName) => {
    const Story = stories[storyName]
    const { container } = render(<Story />)

    if (storyName === 'SetAPassword') {
      await userEvent.setup().click(within(container).getByRole('button', { name: 'Continue' }))
    }

    await waitFor(() => expect(container.textContent).toContain(expectedContent[storyName]))
  })
})
