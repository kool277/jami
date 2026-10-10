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

import ImportAccountLock from './ImportAccountLock.js'
import { LinkFlowHarness, SAMPLE_PEER_DEVICE_ID, SAMPLE_PEER_ID } from './LinkFlowHarness.js'

const peer = { ['peer_id']: SAMPLE_PEER_ID, ['peer_device_id']: SAMPLE_PEER_DEVICE_ID }

const meta = {
  title: 'Link a device/3 - Unlock the account',
  component: ImportAccountLock,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ImportAccountLock>

export default meta
type Story = StoryObj<typeof meta>

const withDetails = (details: Record<string, string>) => [
  (Story: React.ComponentType) => (
    <LinkFlowHarness state={DeviceAuthStateCode.Authenticating} details={details}>
      <Story />
    </LinkFlowHarness>
  ),
]

/** The account is protected, so a password is asked for. */
export const PasswordProtected: Story = {
  decorators: withDetails({ ...peer, ['auth_scheme']: 'password' }),
}

/** Nothing to type in: the user only confirms the device they are linking from. */
export const NoPassword: Story = {
  decorators: withDetails(peer),
}

/** The daemon rejected the credentials and the step is offered again. */
export const RejectedPassword: Story = {
  decorators: withDetails({ ...peer, ['auth_scheme']: 'password', ['auth_error']: 'bad_password' }),
}

/** The daemon told us nothing about the peer, which the page has to survive. */
export const UnknownPeer: Story = {
  decorators: withDetails({ ['auth_scheme']: 'password' }),
}
