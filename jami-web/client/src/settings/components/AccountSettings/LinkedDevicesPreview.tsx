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

import { Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import BaseButton from '../../../components/common/BaseButton.js'
import { useAuthContext } from '../../../contexts/AuthProvider.js'

function LinkedDevicesPreview() {
  const { account } = useAuthContext()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const seeAllDevices = () => {
    navigate('/settings/account/linked-devices')
  }

  const linkNewDevice = () => {
    navigate('/settings/account/linked-devices/export')
  }

  return (
    <Stack aria-label="linked-device" sx={{ gap: 2 }}>
      <Stack sx={{ minWidth: 0, gap: 0.25 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
          <Typography variant="body1">{account.details['Account.deviceName']}</Typography>
          <Typography color="primary" variant="caption">
            {t('current_device')}
          </Typography>
        </Stack>
        <Typography color="text.secondary" noWrap variant="body2" sx={{ fontFamily: 'monospace' }}>
          {account.volatileDetails['Account.deviceID']}
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <BaseButton sx={{ flex: 1 }} onClick={seeAllDevices} variant="outlined">
          {t('see_all_devices')}
        </BaseButton>
        <BaseButton sx={{ flex: 1 }} onClick={linkNewDevice} variant="contained">
          {t('link_new_device')}
        </BaseButton>
      </Stack>
    </Stack>
  )
}

export default LinkedDevicesPreview
