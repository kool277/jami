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

import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'

import JamiIdCard from '../../../components/JamiIdCard.js'
import { useAuthContext } from '../../../contexts/AuthProvider.js'

function ManageAccount() {
  const { t } = useTranslation()
  const { account } = useAuthContext()

  const devices: string[][] = []
  const accountDevices = account.devices
  for (const i in accountDevices) devices.push([i, accountDevices[i]])

  const isJamiAccount = account.getType() === 'RING'

  return (
    <>
      <Typography variant="h2" component="h2" gutterBottom>
        {t('jami_account')}
      </Typography>
      <Grid container spacing={3} style={{ marginBottom: 16 }}>
        {isJamiAccount && (
          <Grid size={12}>
            <JamiIdCard account={account} />
          </Grid>
        )}
      </Grid>
    </>
  )
}

export default ManageAccount
