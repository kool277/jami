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
import { Divider, Stack } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { Fragment, type ReactNode, use, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation } from 'react-router-dom'

import { MessengerContext } from '../../contexts/MessengerProvider.js'
import { isRoutePathActive } from '../../utils/routes.js'
import { ChatBubbleIcon, MailIcon, SettingsIcon } from '../SvgIcon.js'
import AnimatedLogo from './AnimatedLogo.js'
import NavItem from './NavItem.js'

export interface NavRailProps {
  /** Compact renders the rail as a bottom navigation bar for small screens. */
  compact?: boolean
  inviteCount?: number
  unreadConversationCount?: number
  accountSlot: ReactNode
  sx?: SxProps<Theme>
}

/**
 * The four top-level destinations of the app: chats, invites, settings and the
 * account. Calls are started from a conversation, so they are not a destination.
 */
export default function NavRail({ compact, inviteCount, unreadConversationCount, accountSlot, sx }: NavRailProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { lastConversationId, setLastConversationId } = use(MessengerContext)

  const destinations = [
    {
      path: lastConversationId ? `/conversation/${lastConversationId}` : '/conversation',
      activePath: '/conversation',
      label: t('conversations'),
      Icon: ChatBubbleIcon,
      badgeCount: unreadConversationCount,
    },
    { path: '/invites', label: t('invitations'), Icon: MailIcon, badgeCount: inviteCount },
    // Settings configures the app rather than showing people, so a separator
    // keeps it from reading as a third messaging destination.
    { path: '/settings', label: t('settings'), Icon: SettingsIcon, separated: true },
  ]

  useEffect(() => {
    const conversationId = pathname.match(/^\/conversation\/([^/]+)$/)?.[1]
    if (conversationId) {
      setLastConversationId(conversationId)
    }
  }, [pathname, setLastConversationId])

  return (
    <Stack
      component="nav"
      aria-label={t('nav_primary')}
      direction={compact ? 'row' : 'column'}
      sx={[
        {
          // `gap` rather than `spacing`: Stack spacing sets margins on the children,
          // which would fight the account slot's auto margin that pins it to the bottom.
          gap: 0.5,
          alignItems: 'center',
          flexShrink: 0,
          // Wide screens sit the rail inside the navigation island, which already
          // supplies the padding and the separation from the list.
          ...(compact
            ? // The bottom bar sits directly on the backdrop, so it carries its own
              // surface instead of letting the wallpaper show through the labels.
              { p: 1, backgroundColor: 'background.paper', borderTop: 1, borderColor: 'divider' }
            : // The bottom padding keeps the logo clear of the island's rounded corner.
              { width: 56, pb: 1 }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {destinations.map(({ path, activePath = path, label, Icon, badgeCount, separated }) => {
        const selected = isRoutePathActive(pathname, activePath)
        return (
          <Fragment key={path}>
            {/* The bottom bar reads as one row of equal destinations, so the grouping
                is drawn in the rail only. */}
            {separated && !compact && <Divider sx={{ alignSelf: 'stretch', mx: 1, my: 0.5 }} />}
            <NavItem
              component={RouterLink}
              to={path}
              compact={compact}
              label={label}
              // The filled symbol carries the selected state alongside colour, so
              // the destination stays legible without relying on hue alone.
              icon={<Icon filled={selected} />}
              badgeCount={badgeCount || undefined}
              selected={selected}
            />
          </Fragment>
        )
      })}
      <Stack sx={{ ...(compact ? { flex: 1 } : { marginBlockStart: 'auto' }), alignItems: 'center', width: '100%' }}>
        {accountSlot}
      </Stack>
      {/* The bottom bar has no room to spend on a mark that carries no action. */}
      {!compact && <AnimatedLogo />}
    </Stack>
  )
}
