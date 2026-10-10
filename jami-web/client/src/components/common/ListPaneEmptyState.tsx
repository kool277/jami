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
import { Box } from '@mui/material'
import type { ReactNode } from 'react'

import EmptyState from './EmptyState.js'

interface ListPaneEmptyStateProps {
  icon: ReactNode
  title: string
  description: string
}

export default function ListPaneEmptyState({ icon, title, description }: ListPaneEmptyStateProps) {
  return (
    <Box sx={{ display: 'grid', flex: 1, placeItems: 'center' }}>
      <EmptyState
        icon={<Box sx={{ display: 'grid', height: 80, placeItems: 'center' }}>{icon}</Box>}
        title={title}
        description={
          <Box component="span" sx={{ typography: 'body2' }}>
            {description}
          </Box>
        }
      />
    </Box>
  )
}
