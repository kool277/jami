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
import { Stack, Typography } from '@mui/material'
import { type ReactNode, useId } from 'react'

export interface EmptyStateProps {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const titleId = useId()

  return (
    <Stack
      component="section"
      aria-labelledby={titleId}
      spacing={1.5}
      sx={{ alignItems: 'center', p: 3, textAlign: 'center' }}
    >
      {icon}
      <Typography id={titleId} variant="h3">
        {title}
      </Typography>
      {description != null && <Typography color="text.secondary">{description}</Typography>}
      {action}
    </Stack>
  )
}
