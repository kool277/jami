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
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { type ComponentType, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'

import {
  AudioCallIcon,
  ChatBubbleIcon,
  DevicesIcon,
  KeyIcon,
  ManageAccountsIcon,
  SearchRoundedIcon,
  SettingsIcon,
  type SymbolIconProps,
} from '../../components/SvgIcon.js'
import { isRoutePathActive } from '../../utils/routes.js'
import { userSettingsPath, type UserSettingsRoutePath, userSettingsRoutePaths } from '../routes.js'

interface SettingsNavigationItem {
  icon?: ReactNode
  searchTerms?: string[]
  titleKey: string
  path: UserSettingsRoutePath
}

interface SettingsNavigationSection {
  id: string
  titleKey?: string
  icon?: ComponentType<SymbolIconProps>
  searchTerms?: string[]
  items: SettingsNavigationItem[]
}

const sections: SettingsNavigationSection[] = [
  {
    id: 'general',
    titleKey: 'settings_title_general',
    icon: SettingsIcon,
    searchTerms: ['settings_search_preferences', 'settings_search_application'],
    items: [
      {
        icon: <SettingsIcon />,
        titleKey: 'settings_title_system',
        path: userSettingsRoutePaths.generalSystem,
        searchTerms: ['settings_search_language', 'settings_search_notifications'],
      },
      {
        icon: <SettingsIcon />,
        titleKey: 'settings_appearance',
        path: userSettingsRoutePaths.generalAppearance,
        searchTerms: [
          'settings_search_theme',
          'settings_search_dark_mode',
          'settings_search_animations',
          'settings_search_tips',
        ],
      },
      {
        icon: <ChatBubbleIcon />,
        titleKey: 'settings_title_chat',
        path: userSettingsRoutePaths.generalChat,
        searchTerms: ['settings_search_link_preview', 'settings_search_links'],
      },
    ],
  },
  {
    id: 'account',
    titleKey: 'settings_title_account',
    icon: ManageAccountsIcon,
    searchTerms: ['settings_search_profile', 'settings_search_security', 'settings_search_device'],
    items: [
      {
        icon: <ManageAccountsIcon />,
        titleKey: 'settings_account_information',
        path: userSettingsRoutePaths.manageAccount,
        searchTerms: ['settings_search_jami_id', 'settings_search_account_details'],
      },
      {
        titleKey: 'settings_customize_profile',
        path: userSettingsRoutePaths.customizeProfile,
        searchTerms: [
          'settings_search_avatar',
          'settings_search_photo',
          'settings_search_display_name',
          'settings_search_picture',
        ],
      },
      {
        titleKey: 'password_and_passkeys',
        path: userSettingsRoutePaths.passkeys,
        searchTerms: [
          'settings_search_passkey',
          'settings_search_webauthn',
          'settings_search_security_key',
          'settings_search_biometric',
        ],
      },
      {
        icon: <AudioCallIcon />,
        titleKey: 'settings_calls',
        path: userSettingsRoutePaths.calls,
        searchTerms: ['settings_search_moderator', 'settings_search_moderators', 'settings_search_conference'],
      },
      {
        icon: <KeyIcon />,
        titleKey: 'app_access_title',
        path: userSettingsRoutePaths.appAccess,
        searchTerms: ['app_access_search_terms'],
      },
      {
        icon: <DevicesIcon />,
        titleKey: 'settings_linked_devices',
        path: userSettingsRoutePaths.linkedDevices,
        searchTerms: [
          'settings_search_device',
          'settings_search_devices',
          'settings_search_link',
          'settings_search_export',
          'settings_search_transfer',
        ],
      },
    ],
  },
]

function SettingsNavigationItem({ icon, titleKey, path }: SettingsNavigationItem) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const to = userSettingsPath(path)
  const selected = isRoutePathActive(pathname, to)

  return (
    <ListItemButton
      component={NavLink}
      to={to}
      aria-current={selected ? 'page' : undefined}
      selected={selected}
      sx={{
        minHeight: 32,
        py: 0,
        color: selected ? 'primary.dark' : 'text.primary',
        transition: (theme) => theme.transitions.create('color'),
        ...(selected && {
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -9,
            width: 3,
            borderRadius: 999,
            backgroundColor: 'primary.main',
          },
        }),
      }}
    >
      {icon && <ListItemIcon>{icon}</ListItemIcon>}
      <ListItemText
        primary={t(titleKey)}
        slotProps={{ primary: { variant: 'body2', sx: { fontWeight: selected ? 500 : 400 } } }}
      />
    </ListItemButton>
  )
}

export default function SettingsNavigation() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('md'))
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const searchTerms = (terms: string[] | undefined) => (terms ?? []).map((term) => t(term))
  const activeSectionId = sections.find((section) =>
    section.items.some((item) => isRoutePathActive(pathname, userSettingsPath(item.path))),
  )?.id

  return (
    <Stack component="nav" aria-label={t('settings')} sx={{ minHeight: 0, overflowY: 'auto', pb: 2 }}>
      <Typography
        variant="h3"
        sx={isCompact ? { px: 2, pt: 2, pb: 1 } : { px: 2, height: 40, display: 'flex', alignItems: 'center' }}
      >
        {t('settings')}
      </Typography>
      <TextField
        placeholder={t('settings_search_placeholder')}
        size="small"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{
          htmlInput: { 'aria-label': t('settings_search_aria_label') },
          input: {
            startAdornment: (
              <SearchRoundedIcon
                sx={{
                  color: 'text.secondary',
                  transition: (theme) => theme.transitions.create('color'),
                  '.Mui-focused &': { color: 'primary.main' },
                }}
              />
            ),
          },
        }}
        sx={isCompact ? { mx: 1, mb: 1 } : { mx: 1, mt: 0.5, mb: 0 }}
      />
      {/* General is 48px high while rail destinations are 40px, so its list
          starts one pixel below the search field to align their centers. */}
      <List disablePadding sx={isCompact ? undefined : { mt: '1px' }}>
        {sections.map((section) => {
          const isSelected = activeSectionId === section.id
          const sectionMatches =
            normalizedSearch.length > 0 &&
            [section.titleKey && t(section.titleKey), ...searchTerms(section.searchTerms)].some((term) =>
              term?.toLocaleLowerCase().includes(normalizedSearch),
            )
          const visibleItems =
            normalizedSearch.length > 0
              ? sectionMatches
                ? section.items
                : section.items.filter((item) =>
                    [t(item.titleKey), ...searchTerms(item.searchTerms)].some((term) =>
                      term.toLocaleLowerCase().includes(normalizedSearch),
                    ),
                  )
              : section.items
          const SectionIcon = section.icon

          if (normalizedSearch && visibleItems.length === 0) {
            return null
          }

          return (
            <li key={section.id}>
              {section.titleKey && (
                <ListSubheader component="h2" disableSticky sx={{ minHeight: 48, lineHeight: '48px' }}>
                  <ButtonBase
                    component={NavLink}
                    to={userSettingsPath(section.items[0].path)}
                    aria-pressed={isSelected}
                    sx={{
                      width: '100%',
                      minHeight: 48,
                      justifyContent: 'flex-start',
                      gap: 1,
                      px: 1,
                      borderRadius: '9999px',
                      typography: 'body1',
                      fontWeight: 500,
                      color: isSelected ? 'primary.dark' : 'text.secondary',
                      backgroundColor: isSelected ? 'primary.light' : 'transparent',
                    }}
                  >
                    {SectionIcon && <SectionIcon filled={isSelected} />}
                    {t(section.titleKey)}
                  </ButtonBase>
                </ListSubheader>
              )}
              <Collapse in={isCompact || normalizedSearch.length > 0 || isSelected} timeout="auto" unmountOnExit>
                <List
                  disablePadding
                  sx={
                    section.titleKey
                      ? {
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
                        }
                      : undefined
                  }
                >
                  {visibleItems.map((item) => (
                    <SettingsNavigationItem key={item.path} {...item} icon={null} />
                  ))}
                </List>
              </Collapse>
            </li>
          )
        })}
      </List>
    </Stack>
  )
}
