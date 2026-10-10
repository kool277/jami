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
import { ListItemButton, ListItemText, Typography } from '@mui/material'
import { AdminSettingSelection } from '@savoirfairelinux/jami-web-common'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, NavLink } from 'react-router-dom'

import ProcessingRequest from '../../components/ProcessingRequest.js'
import { AuthenticationMethods } from '../../enums/authenticationMethods.js'
import { SettingsPage, SettingsSection } from '../../settings/components/SettingsPage.js'
import { useGetAdminConfigQuery } from '../services/adminQueries.js'

export default function AuthMethods() {
  const { t } = useTranslation()
  const [accessToken] = useState(() => localStorage.getItem('adminAccessToken'))
  const { data } = useGetAdminConfigQuery()

  if (!accessToken) {
    return <Navigate to="/admin/login" replace />
  }
  if (data === undefined) {
    return <ProcessingRequest open />
  }

  const isLocalEnabled = data.localAuthEnabled
  const isJamsEnabled = data.jamsAuthEnabled
  const isOpenIdEnabled = data.openIdAuthEnabled
  const isGuestEnabled = data.guestAccessEnabled

  const methods = [
    { title: t('jami'), enabled: isLocalEnabled, method: AuthenticationMethods.JAMI },
    { title: t('jams'), enabled: isJamsEnabled, method: AuthenticationMethods.JAMS },
    { title: t('openid'), enabled: isOpenIdEnabled, method: AuthenticationMethods.OPENID },
    { title: t('guest'), enabled: isGuestEnabled, method: AuthenticationMethods.GUEST },
  ]

  return (
    <SettingsPage title={t('authentication')}>
      <SettingsSection>
        {methods.map(({ title, enabled, method }) => (
          <ListItemButton
            component={NavLink}
            to={`/admin/${AdminSettingSelection.AUTHENTICATION}/${method}`}
            key={method}
            sx={{ minHeight: 64, mx: 1, my: 0.5, py: 1, borderRadius: '16px' }}
          >
            <ListItemText
              primary={title}
              secondary={
                <Typography sx={{ color: enabled ? 'success.main' : 'error.main' }} variant="body2">
                  {enabled ? t('setting_enabled') : t('setting_disabled')}
                </Typography>
              }
            />
          </ListItemButton>
        ))}
      </SettingsSection>
    </SettingsPage>
  )
}
