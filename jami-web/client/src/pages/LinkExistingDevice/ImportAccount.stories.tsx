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
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import type { Meta, StoryObj } from '@storybook/react-vite'

import ImportAccount from './ImportAccount.js'
import { LinkFlowHarness, SAMPLE_LINK_TOKEN } from './LinkFlowHarness.js'

const meta = {
  title: 'Link a device/1 - Show the code',
  component: ImportAccount,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ImportAccount>

export default meta
type Story = StoryObj<typeof meta>

/** The code and QR the user hands over to the device holding the account. */
export const CodeIssued: Story = {
  decorators: [
    (Story) => (
      <LinkFlowHarness
        state={DeviceAuthStateCode.TokenAvailable}
        linkTokenData={{ jwt: 'story-jwt', details: { token: SAMPLE_LINK_TOKEN } }}
      >
        <Story />
      </LinkFlowHarness>
    ),
  ],
}

/** No code could be obtained, so the only thing left to offer is another go. */
export const CouldNotGetACode: Story = {
  decorators: [
    (Story) => (
      <LinkFlowHarness state={DeviceAuthStateCode.Init} token="" linkTokenFailed>
        <Story />
      </LinkFlowHarness>
    ),
  ],
}
