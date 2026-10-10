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
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import VideocamIcon from '@mui/icons-material/Videocam'
import VideocamOffIcon from '@mui/icons-material/VideocamOff'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import ToggleIconButton from './ToggleIconButton.js'

const meta = {
  title: 'Design system/ToggleIconButton',
  component: ToggleIconButton,
  // The pressed state is drawn in common.white, so the button is only legible on a dark surface.
  // Today that is always the call bar, which sits on video. Rendering the stories on anything
  // lighter makes the pressed glyph disappear, so the backdrop is part of the contract for now.
  decorators: [
    (Story) => (
      <Box sx={{ backgroundColor: 'common.black', borderRadius: 2, display: 'inline-flex', p: 2 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    'aria-label': 'Microphone is on',
    tooltip: 'Microphone is on',
    pressed: true,
    onToggle: () => {},
    IconOn: MicIcon,
    IconOff: MicOffIcon,
  },
} satisfies Meta<typeof ToggleIconButton>

export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

/**
 * State is carried by `aria-pressed` and by the change of glyph, never by colour alone, so the
 * button still reads correctly to a screen reader and to anyone who cannot separate the two fills.
 * Toggle it and inspect the element to see `aria-pressed` flip.
 */
export const Interactive: Story = {
  render: function Interactive(args) {
    const [micOn, setMicOn] = useState(true)
    const [cameraOn, setCameraOn] = useState(false)

    return (
      <Stack direction="row" spacing={2}>
        <ToggleIconButton
          {...args}
          pressed={micOn}
          onToggle={() => setMicOn((on) => !on)}
          aria-label={micOn ? 'Microphone is on' : 'Microphone is off'}
          tooltip={micOn ? 'Microphone is on' : 'Microphone is off'}
          IconOn={MicIcon}
          IconOff={MicOffIcon}
        />
        <ToggleIconButton
          {...args}
          pressed={cameraOn}
          onToggle={() => setCameraOn((on) => !on)}
          aria-label={cameraOn ? 'Camera is on' : 'Camera is off'}
          tooltip={cameraOn ? 'Camera is on' : 'Camera is off'}
          IconOn={VideocamIcon}
          IconOff={VideocamOffIcon}
        />
      </Stack>
    )
  },
}

export const Off: Story = {
  args: {
    pressed: false,
    'aria-label': 'Microphone is off',
    tooltip: 'Microphone is off',
  },
}
