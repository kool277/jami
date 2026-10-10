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

import ImportAccountTransferInProgress from './ImportAccountTransferInProgress.js'
import { LinkFlowHarness } from './LinkFlowHarness.js'

const meta = {
  title: 'Link a device/4 - Transfer the account',
  component: ImportAccountTransferInProgress,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <LinkFlowHarness state={DeviceAuthStateCode.InProgress}>
        <Story />
      </LinkFlowHarness>
    ),
  ],
} satisfies Meta<typeof ImportAccountTransferInProgress>

export default meta
type Story = StoryObj<typeof meta>

/** The account is being transferred. */
export const Transferring: Story = {}
