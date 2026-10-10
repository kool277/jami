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
import {
  ButtonBase,
  Collapse,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material'
import { AdminSettingSelection } from '@savoirfairelinux/jami-web-common'
import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import BaseButton from '../../components/common/BaseButton.js'
import {
  AdminPanelSettingsIcon,
  GppMaybeIcon,
  LogoutIcon,
  ManageAccountsIcon,
  type SymbolIconProps,
} from '../../components/SvgIcon.js'
import { AdminConfigurationOptions } from '../../enums/adminConfigurationOptions.js'
import { AuthenticationMethods } from '../../enums/authenticationMethods.js'
import { isRoutePathActive } from '../../utils/routes.js'

interface NavigationItem {
  title: string
  path: string
}

interface NavigationSection {
  id: string
  icon: ComponentType<SymbolIconProps>
  title: string
  path: string
  activePath: string
  items?: NavigationItem[]
}

interface AdminSettingsNavigationProps {
  /** Compact navigation is an index, so its child destinations stay visible. */
  compact?: boolean
  compactSection?: string
}

export default function AdminSettingsNavigation({ compact = false, compactSection }: AdminSettingsNavigationProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const sections: NavigationSection[] = [
    {
      id: 'configuration',
      icon: AdminPanelSettingsIcon,
      title: t('admin_account_configuration'),
      path: `/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.ACCOUNT}`,
      activePath: `/admin/${AdminSettingSelection.CONFIGURATION}`,
      items: [
        {
          title: t('settings_title_account'),
          path: `/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.ACCOUNT}`,
        },
        {
          title: t('download_limit'),
          path: `/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.AUTO_DOWNLOAD_LIMIT}`,
        },
        {
          title: t('media_settings'),
          path: `/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.MEDIA}`,
        },
      ],
    },
    {
      id: 'accounts',
      icon: ManageAccountsIcon,
      title: t('accounts'),
      path: `/admin/${AdminSettingSelection.ACCOUNTS}`,
      activePath: `/admin/${AdminSettingSelection.ACCOUNTS}`,
    },
    {
      id: 'authentication',
      icon: GppMaybeIcon,
      title: t('authentication'),
      path: `/admin/${AdminSettingSelection.AUTHENTICATION}`,
      activePath: `/admin/${AdminSettingSelection.AUTHENTICATION}`,
      items: [
        {
          title: t('jami'),
          path: `/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.JAMI}`,
        },
        {
          title: t('jams'),
          path: `/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.JAMS}`,
        },
        {
          title: t('openid'),
          path: `/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.OPENID}`,
        },
        {
          title: t('guest'),
          path: `/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.GUEST}`,
        },
      ],
    },
  ]

  const logout = () => {
    localStorage.removeItem('adminAccessToken')
    navigate('/admin/login')
  }
  const visibleSections = compactSection ? sections.filter((section) => section.id === compactSection) : sections

  return (
    <Stack
      component="nav"
      aria-label={t('admin_page_welcome')}
      sx={{ minHeight: 0, flex: 1, overflowY: 'auto', ...(compact && { pt: 2, pb: 2 }) }}
    >
      {!compact && (
        <Typography variant="h3" sx={{ px: 2, pt: { xs: 2, md: 1 }, pb: 1 }}>
          {t('admin_page_welcome')}
        </Typography>
      )}
      <List disablePadding>
        {visibleSections.map((section) => {
          const isSelected = isRoutePathActive(pathname, section.activePath)
          const selectedItemIndex = section.items?.findIndex((item) => isRoutePathActive(pathname, item.path)) ?? -1
          const SectionIcon = section.icon

          return (
            <li key={section.id}>
              {!compact && (
                <ListSubheader component="h2" disableSticky sx={{ minHeight: 48, lineHeight: '48px' }}>
                  <ButtonBase
                    component={NavLink}
                    to={section.path}
                    aria-current={isSelected ? 'page' : undefined}
                    sx={{
                      width: '100%',
                      minHeight: 48,
                      justifyContent: 'flex-start',
                      gap: 1,
                      px: 1,
                      borderRadius: 2,
                      typography: 'body1',
                      fontWeight: 500,
                      color: isSelected ? 'primary.dark' : 'text.secondary',
                      backgroundColor: isSelected ? 'primary.light' : 'transparent',
                    }}
                  >
                    <SectionIcon filled={isSelected} />
                    {section.title}
                  </ButtonBase>
                </ListSubheader>
              )}
              {section.items && (
                <Collapse in={compact || isSelected} timeout="auto" unmountOnExit>
                  <List
                    disablePadding
                    sx={{
                      ml: 3.5,
                      pl: 1,
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: -1,
                        width: 3,
                        borderRadius: 999,
                        backgroundColor: 'divider',
                      },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: `${Math.max(selectedItemIndex, 0) * 32}px`,
                        left: -1,
                        width: 3,
                        height: 32,
                        opacity: selectedItemIndex === -1 ? 0 : 1,
                        borderRadius: 999,
                        backgroundColor: 'primary.main',
                        transition: (theme) => theme.transitions.create(['top', 'opacity']),
                      },
                    }}
                  >
                    {section.items.map((item) => {
                      const selected = isRoutePathActive(pathname, item.path)

                      return (
                        <ListItemButton
                          key={item.path}
                          component={NavLink}
                          to={item.path}
                          aria-current={selected ? 'page' : undefined}
                          sx={{
                            minHeight: 32,
                            py: 0,
                            color: selected ? 'primary.dark' : 'text.primary',
                            transition: (theme) => theme.transitions.create('color'),
                          }}
                        >
                          <ListItemText
                            primary={item.title}
                            slotProps={{ primary: { variant: 'body2', sx: { fontWeight: selected ? 500 : 400 } } }}
                          />
                        </ListItemButton>
                      )
                    })}
                  </List>
                </Collapse>
              )}
            </li>
          )
        })}
      </List>
      {!compact && (
        <BaseButton
          variant="text"
          onClick={logout}
          startIcon={<LogoutIcon />}
          sx={{ justifyContent: 'flex-start', mx: 1, mt: 'auto', mb: 2 }}
        >
          {t('logout')}
        </BaseButton>
      )}
    </Stack>
  )
}
