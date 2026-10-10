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
import { Box, TextField } from '@mui/material'
import { Theme, useTheme } from '@mui/material/styles'
import { HttpStatusCode, MIN_PASSWORD_LENGTH } from '@savoirfairelinux/jami-web-common'
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, useNavigate } from 'react-router-dom'

import BaseButton from '../components/common/BaseButton.js'
import BaseIconButton from '../components/common/BaseIconButton.js'
import PasswordField from '../components/common/PasswordField.js'
import JamiWelcomeLogo from '../components/JamiWelcomeLogo.js'
import ProcessingRequest from '../components/ProcessingRequest.js'
import { ArrowBackIcon } from '../components/SvgIcon.js'
import UnconnectedUserLayout from '../components/UnconnectedUserLayout.js'
import { PasswordStrength } from '../enums/passwordStrength.js'
import { useGetAdminConfigQuery } from '../services/adminConfigQueries.js'
import {
  checkPasswordStrength,
  type NameStatus,
  type PasswordStatus,
  useCheckIfUsernameIsRegisteredQuery,
  useGetAllProviders,
  useLoginMutation,
  useRegisterMutation,
} from '../services/authQueries.js'
import { inputWidth, jamiAuthLogoSize, jamiUsernamePattern, submitButtonWidth } from '../utils/constants.js'

function RegistrationForm() {
  const theme: Theme = useTheme()
  const { t } = useTranslation()
  const [username, setUsername] = useState<string>('')
  const [debouncedUsername, setDebouncedUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [usernameInputStatus, setUsernameInputStatus] = useState<NameStatus>('default')
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus>('default')
  const registerMutation = useRegisterMutation()
  const loginMutation = useLoginMutation()
  const { isPending: isRegisterLoading } = registerMutation
  const { isPending: isLoginLoading } = loginMutation
  const isPending = isRegisterLoading || isLoginLoading
  const { data: response, isError } = useCheckIfUsernameIsRegisteredQuery(debouncedUsername)
  const usernameStatus = useMemo(() => {
    if (usernameInputStatus !== 'valid' || debouncedUsername !== username) {
      return usernameInputStatus
    }
    if (response !== undefined) {
      return response.responseMessage
    }
    if (isError) {
      return 'invalid'
    }
    return usernameInputStatus
  }, [debouncedUsername, isError, response, username, usernameInputStatus])
  const usernameOk = usernameStatus === 'success'
  const usernameError =
    usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'registration_failed'
  const passwordError = passwordStatus === PasswordStrength.TooWeak || passwordStatus === 'registration_failed'
  const passwordOk =
    password.length >= MIN_PASSWORD_LENGTH &&
    passwordStatus !== 'default' &&
    passwordStatus !== 'registration_failed' &&
    passwordStatus !== PasswordStrength.TooWeak
  const { data, isPending: isAdminConfigPending } = useGetAdminConfigQuery()
  const providers = useGetAllProviders()
  const navigate = useNavigate()

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedUsername(username)
    }, 500)
    return () => {
      clearTimeout(timeoutId)
    }
  }, [username])

  useEffect(() => {
    if (data === undefined || isAdminConfigPending) {
      return
    }
    if (!data.localAuthEnabled) {
      navigate('/login')
    }
  }, [data, isAdminConfigPending, navigate])

  if (data === undefined || providers.data === undefined) {
    return <ProcessingRequest open />
  }

  const createAccount = () => {
    registerMutation.mutate(
      { username, password },
      {
        onSuccess: (response) => {
          if (response.status === HttpStatusCode.Created) {
            loginMutation.mutate({ username, password, authMethod: 'local' })
          }
        },
      },
    )
  }

  const handleUsername = async (event: ChangeEvent<HTMLInputElement>) => {
    const usernameValue: string = event.target.value
    setUsername(usernameValue)
    if (usernameValue === '') {
      setUsernameInputStatus('default')
      return
    }
    if (!jamiUsernamePattern.test(usernameValue)) {
      setUsernameInputStatus('invalid')
      return
    }
    //The valid state is when the username passes the Regex test and is ready for availability check.
    setUsernameInputStatus('valid')
  }

  const handlePassword = (event: ChangeEvent<HTMLInputElement>) => {
    const passwordValue: string = event.target.value
    setPassword(passwordValue)
    if (passwordValue.length > 0) {
      const checkResult = checkPasswordStrength(passwordValue)
      setPasswordStatus(checkResult.valueCode)
    } else {
      setPasswordStatus('default')
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const canCreate = usernameOk && passwordOk
    if (canCreate) {
      createAccount()
    } else {
      if (!usernameOk) {
        setUsernameInputStatus('registration_failed')
      }
      if (!passwordOk) {
        setPasswordStatus('registration_failed')
      }
    }
  }

  return (
    <>
      <ProcessingRequest open={isPending} />
      <UnconnectedUserLayout
        showAppearanceControls
        headerAccessory={
          <BaseIconButton aria-label={t('back')} tooltip={t('back')} onClick={() => navigate('/login')}>
            <ArrowBackIcon />
          </BaseIconButton>
        }
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            color: 'text.primary',
            justifyContent: 'center',
            mb: '36px',
          }}
        >
          <JamiWelcomeLogo logoWidth={jamiAuthLogoSize} />
        </Box>

        <Form
          method="post"
          id="register-form"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <TextField
            data-cy="username-input"
            label={t('username_input_label')}
            value={username}
            onChange={handleUsername}
            autoComplete="username"
            error={usernameError}
            helperText={
              usernameStatus !== 'default' && usernameStatus !== 'valid'
                ? t('username_input_helper_text', { context: usernameStatus })
                : undefined
            }
            size="small"
            sx={{ width: theme.typography.pxToRem(inputWidth) }}
          />

          <PasswordField
            data-cy="password-input"
            label={t('password_input_label')}
            value={password}
            onChange={handlePassword}
            autoComplete="new-password"
            error={passwordError}
            helperText={
              passwordStatus === PasswordStrength.TooWeak
                ? t('password_input_helper_text_too_weak')
                : passwordStatus === 'registration_failed'
                  ? t('password_input_helper_text_registration_failed')
                  : undefined
            }
            size="small"
            sx={{ width: theme.typography.pxToRem(inputWidth) }}
          />
          <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <BaseButton
              disabled={!usernameOk || !passwordOk}
              data-cy="register-button"
              variant="contained"
              type="submit"
              onClick={handleSubmit}
              sx={{ width: theme.typography.pxToRem(submitButtonWidth), mt: theme.typography.pxToRem(5) }}
            >
              {t('registration_form_submit_button')}
            </BaseButton>
          </Box>
        </Form>
      </UnconnectedUserLayout>
    </>
  )
}
export default RegistrationForm
