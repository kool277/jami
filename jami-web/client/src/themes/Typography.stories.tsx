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
import Stack from '@mui/material/Stack'
import Typography, { type TypographyProps } from '@mui/material/Typography'
import type { Meta, StoryObj } from '@storybook/react-vite'

const scale: TypographyProps['variant'][] = ['h1', 'h2', 'h3', 'h4', 'h5', 'body1', 'body2', 'caption']

const meta = {
  title: 'Design system/Typography',
  component: Typography,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Typography>

export default meta

type Story = StoryObj<typeof meta>

export const Scale: Story = {
  render: () => (
    <Stack spacing={2}>
      {scale.map((variant) => (
        <Stack key={variant} spacing={0.5}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {variant}
          </Typography>
          <Typography variant={variant}>Jami is free and private communication software</Typography>
        </Stack>
      ))}
    </Stack>
  ),
}

export const Weights: Story = {
  render: () => (
    <Stack spacing={1}>
      {[400, 500, 700].map((weight) => (
        <Typography key={weight} sx={{ fontWeight: weight }}>
          Ubuntu {weight} — Jami is free and private communication software
        </Typography>
      ))}
      <Typography sx={{ fontStyle: 'italic' }}>Ubuntu 400 italic — private by design</Typography>
    </Stack>
  ),
}

// Body copy must stay legible when a reader enlarges their browser font size.
export const LongFormBody: Story = {
  render: () => (
    <Stack spacing={2} sx={{ maxWidth: '60ch' }}>
      <Typography variant="h2">Conversation preferences</Typography>
      <Typography variant="body1">
        Jami is a free and universal communication platform which preserves the privacy and freedoms of its users. It
        does not rely on a central server, so conversations travel directly between participants.
      </Typography>
      <Typography variant="body2">
        Every device you link keeps its own copy of your account, and messages synchronise between them whenever they
        are online at the same time.
      </Typography>
      <Typography variant="caption">Last synchronised a few seconds ago</Typography>
    </Stack>
  ),
}
