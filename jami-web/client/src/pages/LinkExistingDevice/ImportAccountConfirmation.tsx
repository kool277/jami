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
import { Theme, useTheme } from '@mui/material/styles'
import { DeviceAuthStateCode, MIN_PASSWORD_LENGTH } from '@savoirfairelinux/jami-web-common'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import PasswordField from '../../components/common/PasswordField.js'
import { DoneIcon } from '../../components/SvgIcon.js'
import UnconnectedUserLayout from '../../components/UnconnectedUserLayout.js'
import { useImportDeviceContext } from '../../contexts/ImportDeviceProvider.js'
import { PasswordStrength } from '../../enums/passwordStrength.js'
import { checkPasswordStrength, type PasswordStatus, useSetPasswordMutation } from '../../services/authQueries.js'
import { inputWidth, submitButtonWidth } from '../../utils/constants.js'
import LinkFlowProgress from './LinkFlowProgress.js'
import { useImportFlowGuard } from './useImportFlowGuard.js'

export default function ImportAccountConfirmation() {
  const { t } = useTranslation()
  const [hasConfirmed, setHasConfirmed] = useState(false)
  useImportFlowGuard(DeviceAuthStateCode.Done)

  return (
    <UnconnectedUserLayout pageName={t('import_account')} footerAccessory={<LinkFlowProgress currentStep={5} />}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center',
            alignContent: 'center',
            alignItems: 'center',
          }}
        >
          {hasConfirmed ? (
            <SetPassWord />
          ) : (
            <>
              <DoneIcon sx={{ fontSize: 100 }} />
              <Typography variant="body2">{t('import_account_done')}</Typography>
              <BaseButton sx={{ marginTop: '8px' }} variant="contained" onClick={() => setHasConfirmed(true)}>
                {t('continue')}
              </BaseButton>
            </>
          )}
        </Box>
      </Box>
    </UnconnectedUserLayout>
  )
}

const SetPassWord = () => {
  const theme: Theme = useTheme()
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus>('default')
  const passwordOk =
    password.length >= MIN_PASSWORD_LENGTH &&
    passwordStatus !== 'default' &&
    passwordStatus !== 'registration_failed' &&
    passwordStatus !== PasswordStrength.TooWeak
  const { t } = useTranslation()
  const { accountId } = useImportDeviceContext()
  const setPasswordMutation = useSetPasswordMutation(accountId)

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const passwordValue = event.target.value
    setPassword(passwordValue)
    const checkResult = checkPasswordStrength(passwordValue)
    setPasswordStatus(checkResult.valueCode)
  }

  const handleRepeatPasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRepeatPassword(event.target.value)
  }

  const handlePasswordSubmit = () => {
    if (password !== repeatPassword || !passwordOk) {
      return
    }
    setPasswordMutation.mutate(password)
  }

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <Typography variant="body2" sx={{ mb: theme.typography.pxToRem(36) }}>
        {t('create_password_for_online_account')}
      </Typography>

      <PasswordField
        label={t('password_input_label')}
        value={password}
        onChange={handlePasswordChange}
        autoComplete="new-password"
        size="small"
        sx={{ width: theme.typography.pxToRem(inputWidth) }}
        error={passwordStatus === PasswordStrength.TooWeak || passwordStatus === 'registration_failed'}
        helperText={passwordStatus === PasswordStrength.TooWeak ? t('password_input_helper_text_too_weak') : undefined}
      />
      <PasswordField
        label={t('password_input_label_repeat')}
        value={repeatPassword}
        onChange={handleRepeatPasswordChange}
        autoComplete="new-password"
        size="small"
        sx={{ width: theme.typography.pxToRem(inputWidth) }}
        error={repeatPassword !== '' && repeatPassword !== password}
        helperText={
          repeatPassword !== '' && repeatPassword !== password ? t('password_input_helper_text_not_match') : undefined
        }
      />
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <BaseButton
          variant="contained"
          onClick={handlePasswordSubmit}
          sx={{ width: theme.typography.pxToRem(submitButtonWidth), mt: theme.typography.pxToRem(5) }}
        >
          {t('submit')}
        </BaseButton>
      </Box>
    </Box>
  )
}
