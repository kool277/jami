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
import { Skeleton, Stack } from '@mui/material'

import Island, { ISLAND_MARGIN, ISLAND_PADDING } from './Island.js'

export function InviteDetailSkeletonContent() {
  return (
    <Stack spacing="40px" sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Stack spacing="8px" sx={{ alignItems: 'center' }}>
        <Skeleton data-testid="invite-detail-skeleton-avatar" variant="circular" width={200} height={200} />
        <Stack
          data-testid="invite-detail-skeleton-group-title"
          direction="row"
          spacing="4px"
          sx={{ alignItems: 'center' }}
        >
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton variant="text" width={160} height={32} />
        </Stack>
        <Skeleton data-testid="invite-detail-skeleton-description" variant="text" width={240} height={24} />
        <Skeleton variant="text" width={280} height={24} />
        <Skeleton variant="text" width={96} height={20} />
      </Stack>
      <Stack data-testid="invite-detail-skeleton-actions" direction="row" spacing="30px">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} variant="circular" width={40} height={40} />
        ))}
      </Stack>
    </Stack>
  )
}

export default function InviteDetailSkeleton() {
  return (
    <Island
      component="section"
      role="status"
      aria-busy="true"
      aria-label="Loading invitation"
      data-testid="invite-detail-skeleton"
      sx={{
        flex: 1,
        m: ISLAND_MARGIN,
        ml: 0,
        p: `${ISLAND_PADDING} 0px 0px ${ISLAND_PADDING}`,
      }}
    >
      <InviteDetailSkeletonContent />
    </Island>
  )
}
