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
import { Box, ListItemButton, ListItemText, Typography } from '@mui/material'
import { AdminSettingSelection } from '@savoirfairelinux/jami-web-common'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import ProcessingRequest from '../../components/ProcessingRequest.js'
import { AuthenticationMethods } from '../../enums/authenticationMethods.js'
import { SettingsPage, SettingsRow, SettingsSection } from '../../settings/components/SettingsPage.js'
import { useGetAdminConfigQuery, useGetAllOauthClients } from '../services/adminQueries.js'

type OAuthProviderSummary = {
  name: string
  isActive: boolean
  displayName: string
  icon?: string
}

export default function OpenIdAuthMethod() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data } = useGetAdminConfigQuery()
  const providers = useGetAllOauthClients()

  if (data === undefined || providers.data === undefined) {
    return <ProcessingRequest open />
  }

  const handleSelection = (provider: string) => {
    navigate(`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.OPENID}/${provider}`)
  }

  return (
    <SettingsPage title={t('openid_authentication')}>
      <SettingsSection>
        {providers.data.length === 0 ? (
          <SettingsRow title={t('no_oauth_providers')} />
        ) : (
          providers.data.map((provider: OAuthProviderSummary) => (
            <ListItemButton
              key={provider.name}
              onClick={() => handleSelection(provider.name)}
              sx={{ minHeight: 64, borderRadius: '16px' }}
            >
              {provider.icon && (
                <Box
                  component="img"
                  alt=""
                  src={provider.icon}
                  referrerPolicy="no-referrer"
                  sx={{ width: 32, height: 32, mr: 2, objectFit: 'contain', flexShrink: 0 }}
                />
              )}
              <ListItemText
                primary={provider.displayName}
                secondary={
                  <Typography sx={{ color: provider.isActive ? 'success.main' : 'error.main' }} variant="body2">
                    {provider.isActive ? t('setting_enabled') : t('setting_disabled')}
                  </Typography>
                }
              />
            </ListItemButton>
          ))
        )}
      </SettingsSection>
    </SettingsPage>
  )
}
