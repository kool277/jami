/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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

import { Box, Typography } from '@mui/material'
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import { use, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import PasswordField from '../../components/common/PasswordField.js'
import UnconnectedUserLayout from '../../components/UnconnectedUserLayout.js'
import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { useImportDeviceContext } from '../../contexts/ImportDeviceProvider.js'
import { useProvideAccountAuthentication } from '../../services/accountQueries.js'
import { IProvideAccountAuthentication } from '../../utils/utils.js'
import LinkFlowProgress from './LinkFlowProgress.js'
import { useImportFlowGuard } from './useImportFlowGuard.js'

export default function ImportAccountLock() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const { setAlertContent } = use(AlertSnackbarContext)
  const { details, accountId } = useImportDeviceContext()
  const peerId = details.get('peer_id')
  const peerDeviceId = details.get('peer_device_id')
  const hasPassword = details.get('auth_scheme') === 'password'
  const authError = details.get('auth_error') === 'bad_password'
  const provideAccountAuthenticationMutation = useProvideAccountAuthentication()

  useImportFlowGuard(DeviceAuthStateCode.Authenticating)

  useEffect(() => {
    if (!authError) {
      return
    }
    setAlertContent({
      messageI18nKey: 'auth_error_while_linking_device',
      severity: 'error',
      alertOpen: true,
    })
  }, [authError, setAlertContent])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    // An empty password is a legitimate answer: the account may be protected by a scheme the daemon
    // resolves on its own, and only the daemon can tell whether the credentials are accepted.
    const data: IProvideAccountAuthentication = {
      password: hasPassword ? password : '',
      scheme: 'password',
      accountId: accountId,
    }
    provideAccountAuthenticationMutation.mutate(data)
  }

  return (
    <UnconnectedUserLayout
      pageName={hasPassword ? t('unlock_account') : t('confirm_connection')}
      footerAccessory={<LinkFlowProgress currentStep={3} />}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          gap: '20px',
          flexDirection: 'column',
          width: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', width: '100%' }}>
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {t('link_device_peer_id')}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
              {peerId || t('unknown')}
            </Typography>
          </Box>
          <Box sx={{ width: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              {t('link_device_peer_device_id')}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>
              {peerDeviceId || t('unknown')}
            </Typography>
          </Box>
        </Box>
        {hasPassword && (
          <>
            {' '}
            <Box>
              <Typography variant="body2" gutterBottom>
                {t('account_locked_with_password')}
              </Typography>
              <Typography variant="body2" gutterBottom>
                {t('unlock_to_continue')}
              </Typography>
            </Box>
            <PasswordField
              label={t('account_password')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              size="small"
            />
            {authError && (
              <Typography variant="body2" color="error" role="alert">
                {t('incorrect_password')}
              </Typography>
            )}
          </>
        )}
        <BaseButton type="submit" variant="contained" disabled={provideAccountAuthenticationMutation.isPending}>
          {hasPassword ? t('connect') : t('confirm')}
        </BaseButton>
      </Box>
    </UnconnectedUserLayout>
  )
}
