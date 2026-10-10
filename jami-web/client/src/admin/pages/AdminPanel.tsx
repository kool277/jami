/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
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
import { AdminSettingSelection } from '@savoirfairelinux/jami-web-common'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'

import Island, { ISLAND_MARGIN, ISLAND_PADDING } from '../../components/common/Island.js'
import NavItem from '../../components/shell/NavItem.js'
import {
  AdminPanelSettingsIcon,
  ArrowBackIcon,
  GppMaybeIcon,
  LogoutIcon,
  ManageAccountsIcon,
} from '../../components/SvgIcon.js'
import { CompactBackActionContext } from '../../settings/components/SettingsPage.js'
import { isRoutePathActive } from '../../utils/routes.js'
import AdminSettingsNavigation from '../components/AdminSettingsNavigation.js'

const BACKDROP_LIGHT = '/admin/background.jpg'
const BACKDROP_DARK = '/admin/background_dark.jpg'
const ADMIN_LIST_ROUTE = '/admin/settings'

interface AdminPanelProps {
  children: ReactElement
}

function AdminNavRail() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const destinations = [
    {
      path: ADMIN_LIST_ROUTE,
      activePath: `/admin/${AdminSettingSelection.CONFIGURATION}`,
      label: t('admin_account_configuration'),
      Icon: AdminPanelSettingsIcon,
    },
    {
      path: `/admin/${AdminSettingSelection.ACCOUNTS}`,
      activePath: `/admin/${AdminSettingSelection.ACCOUNTS}`,
      label: t('accounts'),
      Icon: ManageAccountsIcon,
    },
    {
      path: `/admin/${AdminSettingSelection.AUTHENTICATION}`,
      activePath: `/admin/${AdminSettingSelection.AUTHENTICATION}`,
      label: t('authentication'),
      Icon: GppMaybeIcon,
    },
  ]

  const logout = () => {
    localStorage.removeItem('adminAccessToken')
    navigate('/admin/login')
  }

  return (
    <Stack
      component="nav"
      aria-label={t('admin_page_welcome')}
      direction="row"
      sx={{ gap: 0.5, p: 1, flexShrink: 0, backgroundColor: 'background.paper', borderTop: 1, borderColor: 'divider' }}
    >
      {destinations.map(({ path, activePath, label, Icon }) => {
        const selected =
          isRoutePathActive(pathname, activePath) ||
          (pathname === ADMIN_LIST_ROUTE && activePath === `/admin/${AdminSettingSelection.CONFIGURATION}`)

        return (
          <NavItem
            key={path}
            component={RouterLink}
            to={path}
            compact
            label={label}
            icon={<Icon filled={selected} />}
            selected={selected}
          />
        )
      })}
      <NavItem compact label={t('logout')} icon={<LogoutIcon />} onClick={logout} />
    </Stack>
  )
}

/**
 * The admin panel is server-scoped rather than account-scoped, so it keeps its
 * own two-pane layout instead of borrowing the messenger navigation rail.
 */
export default function AdminPanel({ children }: AdminPanelProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))
  const { pathname } = useLocation()
  const isDark = theme.palette.mode === 'dark'
  const configurationPath = `/admin/${AdminSettingSelection.CONFIGURATION}`
  const authenticationPath = `/admin/${AdminSettingSelection.AUTHENTICATION}`
  const backPath = isCompact
    ? pathname.startsWith(`${configurationPath}/`)
      ? ADMIN_LIST_ROUTE
      : pathname.startsWith(`${authenticationPath}/`)
        ? authenticationPath
        : undefined
    : undefined
  const navigation = (
    <Stack
      sx={{
        minHeight: 0,
        flexShrink: 0,
        flex: 1,
        width: 320,
        overflowY: 'auto',
      }}
    >
      <AdminSettingsNavigation />
    </Stack>
  )

  return (
    <Stack
      direction={isCompact ? 'column' : 'row'}
      sx={{
        height: '100dvh',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: isCompact ? 'background.paper' : 'background.default',
        ...(!isCompact && {
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: -24,
            backgroundImage: `url(${isDark ? BACKDROP_DARK : BACKDROP_LIGHT})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
            filter: 'blur(16px)',
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            backgroundColor: isDark ? alpha(theme.palette.common.black, 0.55) : alpha(theme.palette.common.white, 0.35),
          },
        }),
        '& > *': { position: 'relative', zIndex: 1 },
      }}
    >
      {!isCompact && <Island sx={{ m: ISLAND_MARGIN, p: ISLAND_PADDING }}>{navigation}</Island>}
      <Box component="main" sx={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto' }}>
        <CompactBackActionContext
          value={
            backPath && (
              <IconButton component={RouterLink} to={backPath} aria-label={t('back')}>
                <ArrowBackIcon />
              </IconButton>
            )
          }
        >
          {children}
        </CompactBackActionContext>
      </Box>
      {isCompact && <AdminNavRail />}
    </Stack>
  )
}
