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
import { Stack, type StackProps } from '@mui/material'

/** Direct pixel values so the shell's geometry is easy to tune in one place. */
export const ISLAND_MARGIN = '8px'
export const ISLAND_PADDING = '8px'
export const ISLAND_RADIUS = '24px'

/**
 * A rounded, elevated surface that groups a region of the app. Islands know
 * nothing about what they wrap, so any surface can become one without the
 * shell changing shape.
 */
export default function Island({ sx, ...props }: StackProps) {
  return (
    <Stack
      sx={[
        (theme) => ({
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          backgroundColor: 'background.paper',
          borderRadius: ISLAND_RADIUS,
          boxShadow: theme.shadows[8],
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    />
  )
}
