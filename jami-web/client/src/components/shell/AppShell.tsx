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
import { alpha, Box, IconButton, Stack, useMediaQuery, useTheme } from '@mui/material'
import { type ReactNode, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation, useOutlet } from 'react-router-dom'

import { useConversationRequestsQuery, useConversationsSummariesQuery } from '../../services/conversationQueries.js'
import { CompactBackActionContext } from '../../settings/components/SettingsPage.js'
import { isConversationUnread } from '../../utils/conversationFilters.js'
import { isElectronMode } from '../../utils/electron.js'
import Island, { ISLAND_MARGIN, ISLAND_PADDING } from '../common/Island.js'
import LoadingSkeleton from '../common/LoadingSkeleton.js'
import { ArrowBackIcon } from '../SvgIcon.js'
import AccountMenu from './AccountMenu.js'
import NavRail from './NavRail.js'

/** Lives in `client/public/admin/`, served from the site root. */
const BACKDROP_LIGHT = '/admin/background.jpg'
const BACKDROP_DARK = '/admin/background_dark.jpg'

export interface AppShellProps {
  /** The middle pane: the list of things the detail pane can show. */
  listPane: ReactNode
  listPaneLabel: string
  /** Sits above the list pane inside the island. Destinations without search leave it out. */
  listSearch?: ReactNode
  /** Route the list pane lives at, used as the target of the narrow-screen back button. */
  listRoute: string
  /** Shown in the detail pane while no child route is matched. */
  placeholder?: ReactNode
  /** Shown while a matched detail route is still loading. */
  detailLoadingFallback?: ReactNode
  /**
   * Hide the narrow-screen navigation bar while a detail is open. The chat
   * surface needs the height for its composer; other destinations keep the bar.
   */
  immersiveDetail?: boolean
}

/**
 * The frame every account-scoped screen lives in: navigation rail, list pane and
 * detail pane. A matched child route owns the detail pane; when there is none,
 * wide screens fall back to the placeholder and narrow screens show the list
 * alone, which is what makes the list⇄detail stack follow the URL instead of a
 * separate menu flag.
 */
export default function AppShell({
  listPane,
  listPaneLabel,
  listSearch,
  listRoute,
  placeholder,
  detailLoadingFallback,
  immersiveDetail,
}: AppShellProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))
  const location = useLocation()
  const outlet = useOutlet()
  const normalizeRoute = (route: string) => route.replace(/\/+$/, '') || '/'
  const hasDetail = outlet !== null && normalizeRoute(location.pathname) !== normalizeRoute(listRoute)
  const usesSettingsCards = listRoute === '/settings'
  const isDark = theme.palette.mode === 'dark'
  const conversationRequestsQuery = useConversationRequestsQuery()
  const conversationsSummariesQuery = useConversationsSummariesQuery()
  const unreadConversationCount = (conversationsSummariesQuery.data || []).filter((conversation) =>
    isConversationUnread(conversation),
  ).length
  // Electron draws no title bar of its own, so the shell background doubles as the
  // window drag surface while the panes on top of it stay interactive.
  const paneSx: { WebkitAppRegion?: string } = isElectronMode() ? { WebkitAppRegion: 'no-drag' } : {}

  const rail = (
    <NavRail
      compact={isCompact}
      inviteCount={conversationRequestsQuery.data?.length}
      unreadConversationCount={unreadConversationCount}
      accountSlot={<AccountMenu compact={isCompact} />}
      sx={paneSx}
    />
  )

  const list = (
    <Stack
      component="section"
      aria-label={listPaneLabel}
      sx={{
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        ...paneSx,
        ...(isCompact ? { flex: 1 } : { width: 320, flexShrink: 0 }),
      }}
    >
      {listSearch && <Box sx={isCompact ? { m: ISLAND_MARGIN } : undefined}>{listSearch}</Box>}
      <Stack sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{listPane}</Stack>
    </Stack>
  )

  // Wide screens read the rail and the list as one navigation object, so the rail
  // joins the list inside a single floating island. Narrow screens have no room to
  // float anything: the rail drops to the bottom of the window on its own.
  const navigation = isCompact ? (
    list
  ) : (
    <Island
      direction="row"
      sx={{ m: ISLAND_MARGIN, p: `${ISLAND_PADDING} 0px 0px ${ISLAND_PADDING}`, gap: ISLAND_PADDING, ...paneSx }}
    >
      {rail}
      {list}
    </Island>
  )

  const main = (
    <Box component="main" sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', ...paneSx }}>
      <CompactBackActionContext
        value={
          isCompact &&
          hasDetail &&
          usesSettingsCards && (
            <IconButton component={RouterLink} to={listRoute} aria-label={t('back')}>
              <ArrowBackIcon />
            </IconButton>
          )
        }
      >
        <Suspense fallback={detailLoadingFallback ?? <LoadingSkeleton />}>
          {outlet ?? <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{placeholder}</Stack>}
        </Suspense>
      </CompactBackActionContext>
    </Box>
  )

  return (
    <Stack
      direction={isCompact ? 'column' : 'row'}
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: isCompact ? 'background.paper' : 'background.default',
        ...(isElectronMode() && { WebkitAppRegion: 'drag' }),
        // The backdrop is painted by pseudo-elements rather than a wrapper: a
        // filter applies to a whole element tree, so blurring a real ancestor
        // would blur the islands with it. The negative inset hides the soft
        // edge the blur leaves at the viewport border.
        ...(!isCompact && {
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: -24,
            backgroundImage: `url(${isDark ? BACKDROP_DARK : BACKDROP_LIGHT})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(16px)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundColor: isDark ? alpha(theme.palette.common.black, 0.55) : alpha(theme.palette.common.white, 0.35),
          },
        }),
        // Every pane sits above the backdrop layers.
        '& > *': { position: 'relative', zIndex: 1 },
      }}
    >
      {(!isCompact || !hasDetail) && navigation}
      {isCompact && hasDetail && !usesSettingsCards && (
        <Box sx={{ flexShrink: 0, p: 0.5, borderBottom: 1, borderColor: 'divider', ...paneSx }}>
          <IconButton component={RouterLink} to={listRoute} aria-label={t('back')}>
            <ArrowBackIcon />
          </IconButton>
        </Box>
      )}
      {(!isCompact || hasDetail) && main}
      {isCompact && !(hasDetail && immersiveDetail) && rail}
    </Stack>
  )
}
