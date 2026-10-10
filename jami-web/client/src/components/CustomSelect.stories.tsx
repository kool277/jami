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
import { useState } from 'react'

import { CustomSelect, type SelectOption } from './CustomSelect.js'
import { LanguageIcon } from './SvgIcon.js'

const options: SelectOption<string>[] = [
  { label: 'English', payload: 'en' },
  { label: 'French', payload: 'fr' },
  { label: 'Spanish', payload: 'es' },
]

const meta = {
  title: 'Design system/CustomSelect',
  component: CustomSelect,
  args: {
    option: options[0],
    options,
    onChange: () => {},
    size: 'small',
    startAdornment: <LanguageIcon />,
  },
} satisfies Meta<typeof CustomSelect>

export default meta

type Story = StoryObj<typeof meta>

export const Interactive: Story = {
  render: function Interactive(args) {
    const [option, setOption] = useState(args.option)

    return <CustomSelect {...args} option={option} onChange={(newOption) => setOption(newOption ?? undefined)} />
  },
}
