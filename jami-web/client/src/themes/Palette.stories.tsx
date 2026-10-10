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

const relativeLuminance = (color: string): number => {
  const channels = [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrastRatio = (foreground: string, background: string): number => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

const Swatch = ({ name, color, on }: { name: string; color: string; on: string }) => {
  // Ratios are only meaningful for opaque hex values; anything else is reported as unknown.
  const isHex = /^#[0-9a-f]{6}$/i.test(color)
  const ratio = isHex && /^#[0-9a-f]{6}$/i.test(on) ? contrastRatio(color, on) : undefined

  return (
    <Stack sx={{ minWidth: 168 }}>
      <Box sx={{ backgroundColor: color, height: 56, borderRadius: 1, border: '1px solid rgba(128,128,128,0.35)' }} />
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
        {color}
      </Typography>
      {ratio !== undefined && (
        <Typography variant="caption" sx={{ color: ratio >= 4.5 ? 'success.main' : 'error.main' }}>
          {ratio.toFixed(2)}:1 {ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large only' : 'fails'}
        </Typography>
      )}
    </Stack>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Stack spacing={1}>
    <Typography variant="h3">{title}</Typography>
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', rowGap: 2 }}>
      {children}
    </Stack>
  </Stack>
)

const PaletteSheet = () => {
  const theme = useTheme()
  const { palette } = theme
  const surface = palette.background.default

  return (
    <Stack spacing={4} sx={{ p: 3, backgroundColor: 'background.default' }}>
      <Section title="Brand">
        <Swatch name="primary.light (surface)" color={palette.primary.light} on={palette.text.primary} />
        <Swatch name="primary.main" color={palette.primary.main} on={surface} />
        <Swatch name="primary.dark (accent)" color={palette.primary.dark} on={surface} />
      </Section>
      <Section title="Status">
        <Swatch name="error.main" color={palette.error.main} on={surface} />
        <Swatch name="error.dark" color={palette.error.dark} on={surface} />
        <Swatch name="success.main" color={palette.success.main} on={surface} />
        <Swatch name="secondary.main (surface)" color={palette.secondary.main} on={palette.text.primary} />
      </Section>
      <Section title="Surfaces and text">
        <Swatch name="background.default" color={palette.background.default} on={palette.text.primary} />
        <Swatch name="background.paper" color={palette.background.paper} on={palette.text.primary} />
        <Swatch name="text.primary" color={palette.text.primary} on={surface} />
        <Swatch name="text.secondary" color={palette.text.secondary} on={surface} />
      </Section>
      <Section title="Buttons on their own colour">
        <Stack direction="row" spacing={2}>
          {(['primary', 'error', 'success'] as const).map((slot) => (
            <Box
              key={slot}
              sx={{
                backgroundColor: palette[slot].dark ?? palette[slot].main,
                color: palette[slot].contrastText,
                px: 3,
                py: 1,
                borderRadius: '9999px',
                typography: 'button',
              }}
            >
              {slot}
            </Box>
          ))}
        </Stack>
      </Section>
    </Stack>
  )
}

const meta = {
  title: 'Design tokens/Palette',
  component: PaletteSheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PaletteSheet>

export default meta

export const Palette: StoryObj<typeof meta> = {}
