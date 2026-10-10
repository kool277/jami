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
import { type ReactNode } from 'react'

import Island, { ISLAND_PADDING } from './Island.js'

export interface LoadingSkeletonProps {
  content?: ReactNode
  contentIsland?: boolean
  fullPage?: boolean
  lines?: number
  navigation?: 'conversations' | 'settings'
}

function NavigationSkeleton({ navigation }: Pick<LoadingSkeletonProps, 'navigation'>) {
  return (
    <Stack
      data-testid="loading-skeleton-navigation"
      direction="row"
      spacing={ISLAND_PADDING}
      sx={{ flex: 1, minHeight: 0 }}
    >
      <Stack spacing={1} sx={{ width: 56, flexShrink: 0, alignItems: 'center' }}>
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} variant="circular" width={40} height={40} />
        ))}
        <Skeleton variant="rounded" width={40} height={1} sx={{ my: 0.5 }} />
        <Skeleton variant="circular" width={40} height={40} />
        <Stack sx={{ flex: 1 }} />
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="rounded" width={40} height={20} />
      </Stack>
      {navigation === 'settings' ? <SettingsNavigationSkeleton /> : <ConversationNavigationSkeleton />}
    </Stack>
  )
}

function ConversationNavigationSkeleton() {
  return (
    <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
      <Skeleton variant="rounded" height={40} sx={{ borderRadius: '9999px' }} />
      <Stack direction="row" spacing={1}>
        <Skeleton variant="rounded" width={48} height={32} sx={{ borderRadius: '9999px' }} />
        <Skeleton variant="rounded" width={64} height={32} sx={{ borderRadius: '9999px' }} />
        <Skeleton variant="rounded" width={64} height={32} sx={{ borderRadius: '9999px' }} />
      </Stack>
      <Stack spacing={0.5}>
        {Array.from({ length: 5 }, (_, index) => (
          <ConversationSkeleton key={index} />
        ))}
      </Stack>
    </Stack>
  )
}

function SettingsNavigationSkeleton() {
  return (
    <Stack data-testid="loading-skeleton-settings-navigation" sx={{ minWidth: 0, flex: 1 }}>
      <Skeleton data-testid="loading-skeleton-settings-title" variant="text" width="45%" height={40} sx={{ ml: 2 }} />
      <Skeleton data-testid="loading-skeleton-settings-search" variant="rounded" height={40} sx={{ mx: 1, mt: 1 }} />
      <Stack spacing={0.5} sx={{ mt: '17px' }}>
        <SettingsSectionSkeleton rows={5} />
        <SettingsSectionSkeleton rows={0} />
      </Stack>
    </Stack>
  )
}

function SettingsSectionSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 1, minHeight: 48 }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="text" width={96} height={24} />
      </Stack>
      <Stack spacing={0.25} sx={{ ml: 4.5, pl: 1 }}>
        {Array.from({ length: rows }, (_, index) => (
          <SettingsNavigationRowSkeleton key={index} />
        ))}
      </Stack>
    </Stack>
  )
}

function SettingsNavigationRowSkeleton() {
  return (
    <Stack data-testid="loading-skeleton-settings-row" sx={{ justifyContent: 'center', minHeight: 32 }}>
      <Skeleton variant="text" width="65%" height={20} />
    </Stack>
  )
}

function ConversationSkeleton() {
  return (
    <Stack
      data-testid="loading-skeleton-conversation"
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', minHeight: 64, px: 0.75 }}
    >
      <Skeleton variant="circular" width={40} height={40} />
      <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="85%" height={16} />
      </Stack>
    </Stack>
  )
}

export default function LoadingSkeleton({
  content,
  contentIsland = false,
  fullPage = false,
  lines = 4,
  navigation = 'conversations',
}: LoadingSkeletonProps) {
  const placeholders = Array.from({ length: lines }, (_, index) => (
    <Skeleton key={index} variant="rounded" height={48} />
  ))

  if (fullPage) {
    return (
      <Stack
        role="status"
        aria-busy="true"
        aria-label="Loading"
        direction={{ xs: 'column', md: 'row' }}
        spacing="4px"
        sx={{ minHeight: '100dvh', p: ISLAND_PADDING, bgcolor: 'background.default' }}
      >
        <Island data-testid="loading-skeleton-island" sx={{ p: ISLAND_PADDING, width: { md: 416 }, flexShrink: 0 }}>
          <NavigationSkeleton navigation={navigation} />
        </Island>
        {contentIsland && (
          <Island data-testid="loading-skeleton-island" spacing={1.5} sx={{ flex: 1, p: ISLAND_PADDING }}>
            {content ?? placeholders}
          </Island>
        )}
      </Stack>
    )
  }

  return (
    <Stack role="status" aria-busy="true" aria-label="Loading" spacing={1.5} sx={{ p: 2 }}>
      {placeholders}
    </Stack>
  )
}
