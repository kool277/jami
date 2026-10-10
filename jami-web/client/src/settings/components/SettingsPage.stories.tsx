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
import { Switch } from '@mui/material'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { SettingsPage, SettingsRow, SettingsSection } from './SettingsPage.js'

const meta = {
  title: 'Settings/Page',
  component: SettingsPage,
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Appearance',
    description: 'Choose how Jami Web looks and behaves.',
    children: (
      <SettingsSection title="Theme" description="Use your preferred interface style.">
        <SettingsRow title="Dark mode" description="Use dark colors throughout the application." control={<Switch />} />
      </SettingsSection>
    ),
  },
} satisfies Meta<typeof SettingsPage>

export default meta

type Story = StoryObj<typeof meta>

export const Standard: Story = {}

export const DescriptionOnOwnLine: Story = {
  args: {},
}
