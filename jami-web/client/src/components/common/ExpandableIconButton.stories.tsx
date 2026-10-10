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
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import MicIcon from '@mui/icons-material/Mic'
import SpeakerIcon from '@mui/icons-material/Speaker'
import VideocamIcon from '@mui/icons-material/Videocam'
import Box from '@mui/material/Box'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { ExpandableButton } from './ExpandableIconButton.js'

const meta = {
  title: 'Design system/ExpandableIconButton',
  component: ExpandableButton,
  // The button takes no colour of its own; its only caller is the call bar, which wraps it in a
  // styled component supplying white on top of video. The caret is a second icon button that
  // picks the colour up through `className`, so the decorator colours both the way the call bar
  // does. It also hangs outside the button's own box, hence the padding.
  decorators: [
    (Story) => (
      <Box
        sx={{
          backgroundColor: 'common.black',
          borderRadius: 2,
          display: 'inline-flex',
          p: 4,
          '& .MuiIconButton-root': { color: 'common.white' },
        }}
      >
        <Story />
      </Box>
    ),
  ],
  args: {
    'aria-label': 'Microphone',
    Icon: MicIcon,
  },
} satisfies Meta<typeof ExpandableButton>

export default meta

type Story = StoryObj<typeof meta>

/** Without options it is an ordinary icon button; the caret only appears when there is a menu. */
export const Playground: Story = {}

export const WithMenu: Story = {
  args: {
    expandMenuOptions: [
      { description: 'Built-in microphone', icon: <MicIcon fontSize="small" /> },
      { description: 'Headset microphone', icon: <HeadsetMicIcon fontSize="small" /> },
      { description: 'Speakerphone', icon: <SpeakerIcon fontSize="small" /> },
    ],
  },
}

/** In a vertical bar the caret moves to the side and rotates to point along the bar. */
export const Vertical: Story = {
  args: {
    isVertical: true,
    Icon: VideocamIcon,
    'aria-label': 'Camera',
    expandMenuOptions: [
      { description: 'Front camera', icon: <VideocamIcon fontSize="small" /> },
      { description: 'Screen share', icon: <SpeakerIcon fontSize="small" /> },
    ],
  },
}

/** The whole button opens the menu rather than only the caret. */
export const MenuOnClick: Story = {
  args: {
    expandMenuOnClick: true,
    expandMenuOptions: [
      { description: 'Built-in microphone', icon: <MicIcon fontSize="small" /> },
      { description: 'Headset microphone', icon: <HeadsetMicIcon fontSize="small" /> },
    ],
  },
}
