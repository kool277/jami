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
import { Box, Stack, Typography, useTheme } from '@mui/material'
import { Meta, StoryObj } from '@storybook/react-vite'

const steps = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8]

const Step = ({ step }: { step: number }) => {
  const theme = useTheme()
  const width = theme.spacing(step)

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 72 }}>
        {step}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace', minWidth: 64 }}>
        {width}
      </Typography>
      <Box sx={{ backgroundColor: 'primary.main', borderRadius: 0.5, height: 16, width }} />
    </Stack>
  )
}

const SpacingSheet = () => (
  <Stack spacing={3} sx={{ backgroundColor: 'background.default', minHeight: '100vh', p: 4 }}>
    <Stack spacing={1}>
      <Typography variant="h2">Spacing</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 560 }}>
        One step is 8px. Layout takes its gaps and padding from this scale — <code>gap: 1</code>, <code>p: 2</code>,{' '}
        <code>theme.spacing(3)</code> — rather than pixel strings, so the rhythm stays consistent and changes to the
        base propagate everywhere.
      </Typography>
    </Stack>

    <Stack spacing={1.5}>
      {steps.map((step) => (
        <Step key={step} step={step} />
      ))}
    </Stack>
  </Stack>
)

const meta = {
  title: 'Design tokens/Spacing',
  component: SpacingSheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SpacingSheet>

export default meta

export const Spacing: StoryObj<typeof meta> = {}
