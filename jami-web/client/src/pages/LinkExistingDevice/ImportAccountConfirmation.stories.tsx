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
import { expect, userEvent, within } from 'storybook/test'

import ImportAccountConfirmation from './ImportAccountConfirmation.js'
import { LinkFlowHarness } from './LinkFlowHarness.js'

const meta = {
  title: 'Link a device/5 - Confirm the import',
  component: ImportAccountConfirmation,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <LinkFlowHarness state={DeviceAuthStateCode.Done}>
        <Story />
      </LinkFlowHarness>
    ),
  ],
} satisfies Meta<typeof ImportAccountConfirmation>

export default meta
type Story = StoryObj<typeof meta>

/** The account has landed on this device. */
export const Imported: Story = {}

/**
 * The password step, which is only reachable behind the confirmation, so the story walks through
 * it rather than duplicating the component.
 */
export const SetAPassword: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button'))
    await expect(await canvas.findByRole('button', { name: /submit/i })).toBeVisible()
  },
}
