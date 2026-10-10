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

import { Switch } from '@mui/material'
import { useTranslation } from 'react-i18next'

import ProcessingRequest from '../../components/ProcessingRequest.js'
import { SettingsPage } from '../../settings/components/SettingsPage.js'
import { useGetAdminConfigQuery, useUpdateAdminConfigMutation } from '../services/adminQueries.js'

export default function GuestAuthMethod() {
  const saveAdminConfigMutation = useUpdateAdminConfigMutation()
  const { t } = useTranslation()
  const { data } = useGetAdminConfigQuery()

  // TODO: handle error and notify the user that something went wrong
  if (data === undefined) {
    return <ProcessingRequest open />
  }

  const handleChange = () => {
    saveAdminConfigMutation.mutate({ guestAccessEnabled: !data.guestAccessEnabled })
  }

  return (
    <SettingsPage
      title={t('guest_authentication')}
      description={t('guest_authentication_info')}
      headerEndAction={
        <Switch
          checked={data.guestAccessEnabled}
          onChange={handleChange}
          slotProps={{ input: { 'aria-label': t('setting_auth_change', { authMethod: t('guest') }) } }}
        />
      }
    />
  )
}
