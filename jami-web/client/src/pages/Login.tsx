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
import Fingerprint from '@mui/icons-material/Fingerprint'
import { Box, Divider, FormControl, FormControlLabel, Radio, RadioGroup, TextField, Typography } from '@mui/material'
import { darken, Theme, useTheme } from '@mui/material/styles'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { ChangeEvent, FormEvent, use, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, useNavigate } from 'react-router-dom'

import BaseButton from '../components/common/BaseButton.js'
import PasswordField from '../components/common/PasswordField.js'
import JamiWelcomeLogo from '../components/JamiWelcomeLogo.js'
import ProcessingRequest from '../components/ProcessingRequest.js'
import UnconnectedUserLayout from '../components/UnconnectedUserLayout.js'
import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { AuthenticationMethods } from '../enums/authenticationMethods.js'
import { useGetAdminConfigQuery } from '../services/adminConfigQueries.js'
import { useGetAllProviders, useLoginMutation } from '../services/authQueries.js'
import { usePasskeyLoginMutation } from '../services/passkeyQueries.js'
import { inputWidth, jamiAuthLogoSize, submitButtonWidth } from '../utils/constants.js'
import { isElectronMode } from '../utils/electron.js'

function LoginForm() {
  const currentUrl = window.location.href
  const accessToken = currentUrl.split('accessToken=')[1]

  const theme: Theme = useTheme()
  const authActionWidth = theme.typography.pxToRem(submitButtonWidth + 140)
  const providerButtonHeight = 36
  const providerLogoSize = 25
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [username, setUsername] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [authMethod, setAuthMethod] = useState<string | undefined>()
  const { data } = useGetAdminConfigQuery()
  const { setAlertContent } = use(AlertSnackbarContext)
  const loginMutation = useLoginMutation()
  const passkeyLoginMutation = usePasskeyLoginMutation()
  const { isPending } = loginMutation
  const isPasskeyPending = passkeyLoginMutation.isPending
  const passkeySupported = browserSupportsWebAuthn()
  const providers = useGetAllProviders()

  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken)
      window.location.replace('/conversation')
    }
  }, [accessToken])

  if (data === undefined || providers.data === undefined) {
    return <ProcessingRequest open />
  }

  const selectedAuthMethod =
    authMethod ??
    (data.localAuthEnabled ? 'local' : data.jamsAuthEnabled ? 'jams' : data.guestAccessEnabled ? 'guest' : 'openid')

  const handleUsername = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value)
  }

  const handlePassword = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value)
  }

  const handleSelectionChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAuthMethod(event.target.value)
  }

  const isAlone = [data.localAuthEnabled, data.jamsAuthEnabled].filter((value) => value === true).length === 1
  const login = (event: FormEvent) => {
    event.preventDefault()

    if (username === '') {
      setAlertContent({ messageI18nKey: 'username_input_helper_text_empty', severity: 'error', alertOpen: true })
      return
    }
    // In Electron mode, local accounts don't require a password
    if (password === '' && !(isElectronMode() && selectedAuthMethod === 'local')) {
      setAlertContent({ messageI18nKey: 'password_input_helper_text_empty', severity: 'error', alertOpen: true })
      return
    }
    loginMutation.mutate({ username, password, authMethod: selectedAuthMethod })
  }

  const guestLogin = (event: FormEvent) => {
    event.preventDefault()
    loginMutation.mutate({ username, password, authMethod: 'guest' })
  }

  return (
    <>
      <ProcessingRequest open={isPending || isPasskeyPending} />
      <UnconnectedUserLayout cardWidth="700px" showAppearanceControls>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            color: 'text.primary',
            justifyContent: 'center',
          }}
        >
          <JamiWelcomeLogo logoWidth={jamiAuthLogoSize} />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
            mt: '36px',
            position: 'relative',
            '&::before': {
              content: '""',
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              borderLeft: 1,
              borderColor: 'divider',
            },
          }}
        >
          <Form
            method="post"
            id="login-form"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TextField
              data-cy="username-input"
              label={t('username_input_label')}
              value={username}
              onChange={handleUsername}
              autoComplete="username"
              size="small"
              sx={{ width: theme.typography.pxToRem(inputWidth) }}
            />
            {/* In Electron mode, local accounts don't require a password */}
            {!(isElectronMode() && selectedAuthMethod === 'local') && (
              <PasswordField
                data-cy="password-input"
                label={t('password_input_label')}
                value={password}
                onChange={handlePassword}
                size="small"
                sx={{ width: theme.typography.pxToRem(inputWidth) }}
              />
            )}
            {!isAlone && (
              <FormControl
                sx={{
                  marginTop: '16px',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <RadioGroup
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    maxWidth: '200px',
                    marginLeft: '16px',
                  }}
                  row
                  onChange={handleSelectionChange}
                  value={selectedAuthMethod}
                >
                  {data.localAuthEnabled && <FormControlLabel value="local" control={<Radio />} label={t('jami')} />}
                  {data.jamsAuthEnabled && <FormControlLabel value="jams" control={<Radio />} label={t('jams')} />}
                </RadioGroup>
              </FormControl>
            )}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignContent: 'center',
                alignItems: 'center',
                marginTop: '12px',
              }}
            >
              {(data.localAuthEnabled || data.jamsAuthEnabled) && (
                <BaseButton
                  data-cy="login-button"
                  variant="contained"
                  type="submit"
                  onClick={login}
                  sx={{ width: authActionWidth, mt: theme.typography.pxToRem(5) }}
                  disabled={
                    selectedAuthMethod !== AuthenticationMethods.GUEST &&
                    (username === '' || (password === '' && !(isElectronMode() && selectedAuthMethod === 'local')))
                  }
                >
                  {t('login_form_submit_button')}
                </BaseButton>
              )}
            </Box>
            {data.localAuthEnabled && passkeySupported && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                <BaseButton
                  variant="outlined"
                  type="button"
                  startIcon={<Fingerprint />}
                  onClick={() => passkeyLoginMutation.mutate(username || undefined)}
                  disabled={isPasskeyPending}
                  sx={{ width: authActionWidth }}
                >
                  {t('passkey_login_button')}
                </BaseButton>
              </Box>
            )}
            {data.guestAccessEnabled && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                <BaseButton
                  data-cy="guest-login-button"
                  variant="outlined"
                  type="button"
                  onClick={guestLogin}
                  sx={{ width: authActionWidth }}
                >
                  {t('login_as_guest')}
                </BaseButton>
              </Box>
            )}
          </Form>

          <Box
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gridColumn: { xs: 'auto', md: '2' },
              gridRow: { xs: 'auto', md: '1' },
              gap: 1,
            }}
          >
            {data.localAuthEnabled && (
              <BaseButton
                variant="contained"
                type="button"
                onClick={() => navigate('/register')}
                sx={{ width: authActionWidth }}
              >
                {t('login_form_to_registration_link')}
              </BaseButton>
            )}
            <BaseButton
              variant="contained"
              type="button"
              onClick={() => navigate('/import-account')}
              sx={{ width: authActionWidth }}
            >
              {t('connect_from_another_device')}
            </BaseButton>
            {data.openIdAuthEnabled && providers.data.length > 0 && (
              <Box component="section" sx={{ width: '100%', mt: 1 }}>
                <Divider sx={{ width: '60%', mx: 'auto', mb: 1 }} />
                <Typography variant="body2" sx={{ mb: 1, textAlign: 'center', fontStyle: 'italic' }}>
                  {t('openid_login_with')}
                </Typography>
                <Box
                  component="ul"
                  aria-label={t('openid')}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 1,
                    listStyle: 'none',
                    m: 0,
                    p: 0,
                  }}
                >
                  {providers.data.map(
                    (item: {
                      provider: string
                      displayName: string
                      colorTheme: string
                      icon: string
                      redirectUri: string
                    }) => (
                      <Box component="li" key={item.provider} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <BaseButton
                          sx={{
                            width: authActionWidth,
                            minHeight: theme.typography.pxToRem(providerButtonHeight),
                            backgroundColor: item.colorTheme || undefined,
                            color: item.colorTheme ? theme.palette.getContrastText(item.colorTheme) : undefined,
                            '&:hover': {
                              backgroundColor: item.colorTheme ? darken(item.colorTheme, 0.15) : undefined,
                              color: item.colorTheme
                                ? theme.palette.getContrastText(darken(item.colorTheme, 0.15))
                                : undefined,
                            },
                          }}
                          variant="contained"
                          aria-label={`${t('openid_login_with')} ${item.displayName}`}
                          onClick={() => window.location.replace(item.redirectUri)}
                        >
                          <Box
                            sx={{
                              width: '100%',
                              display: 'grid',
                              gridTemplateColumns: `${providerLogoSize}px minmax(0, 1fr) ${providerLogoSize}px`,
                              alignItems: 'center',
                            }}
                          >
                            {item.icon && (
                              <Box
                                component="img"
                                src={item.icon}
                                alt=""
                                sx={{
                                  width: theme.typography.pxToRem(providerLogoSize),
                                  height: theme.typography.pxToRem(providerLogoSize),
                                  gridColumn: 1,
                                  justifySelf: 'start',
                                }}
                              />
                            )}
                            <Typography
                              sx={{
                                gridColumn: 2,
                                minWidth: 0,
                                textAlign: 'center',
                                overflowWrap: 'anywhere',
                                fontWeight: 'bolder',
                              }}
                            >
                              {item.displayName}
                            </Typography>
                            <Box sx={{ gridColumn: 3 }} />
                          </Box>
                        </BaseButton>
                      </Box>
                    ),
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </UnconnectedUserLayout>
    </>
  )
}
export default LoginForm
