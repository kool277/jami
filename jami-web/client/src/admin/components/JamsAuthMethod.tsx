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
import { Box, InputAdornment, Stack, Switch, TextField } from '@mui/material'
import { urlRegex } from '@savoirfairelinux/jami-web-common'
import { ChangeEvent, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, Navigate } from 'react-router-dom'

import BaseButton from '../../components/common/BaseButton.js'
import ProcessingRequest from '../../components/ProcessingRequest.js'
import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import jamiLogoIcon from '../../icons/jamiLogoIcon.svg'
import { SettingsPage, SettingsSection } from '../../settings/components/SettingsPage.js'
import {
  useGetAdminConfigQuery,
  useGetJamsUrl,
  useSetJamsUrl,
  useUpdateAdminConfigMutation,
} from '../services/adminQueries.js'

const JamsAuthMethod = () => {
  const [accessToken] = useState(() => localStorage.getItem('adminAccessToken'))
  const { data } = useGetAdminConfigQuery()
  const jamsUrlQuery = useGetJamsUrl()
  const jamsCurrentUrl = jamsUrlQuery.data

  if (!accessToken) {
    return <Navigate to="/admin/login" replace />
  }

  if (data === undefined || jamsCurrentUrl === undefined) {
    return <ProcessingRequest open />
  }

  return <JamsAuthMethodForm key={jamsCurrentUrl} data={data} jamsCurrentUrl={jamsCurrentUrl} />
}

const JamsAuthMethodForm = ({
  data,
  jamsCurrentUrl,
}: {
  data: NonNullable<ReturnType<typeof useGetAdminConfigQuery>['data']>
  jamsCurrentUrl: string
}) => {
  const { t } = useTranslation()
  const saveAdminConfigMutation = useUpdateAdminConfigMutation()
  const setJamsUrlMutation = useSetJamsUrl()
  const [jamsUrl, setJamsUrl] = useState<string>(jamsCurrentUrl)
  const { setAlertContent } = use(AlertSnackbarContext)

  const handleChange = () => {
    saveAdminConfigMutation.mutate({ jamsAuthEnabled: !data.jamsAuthEnabled })
  }

  const submitNewJamsUrl = async () => {
    if (jamsUrl === jamsCurrentUrl) {
      setAlertContent({
        messageI18nKey: 'setting_jams_server_error_same_value',
        severity: 'error',
        alertOpen: true,
      })
      return
    }
    if (!urlRegex.test(jamsUrl)) {
      setAlertContent({
        messageI18nKey: 'setting_jams_server_error',
        severity: 'error',
        alertOpen: true,
      })
      return
    }
    setJamsUrlMutation.mutate(jamsUrl)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitNewJamsUrl()
  }

  return (
    <SettingsPage
      title={t('jams_authentication')}
      description={t('jams_authentication_info')}
      headerEndAction={
        <Switch
          checked={data.jamsAuthEnabled}
          onChange={handleChange}
          slotProps={{ input: { 'aria-label': t('setting_auth_change', { authMethod: t('jams') }) } }}
        />
      }
    >
      <SettingsSection title={t('jams_url')} list={false}>
        <Form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              id="jams-url-input"
              fullWidth
              size="small"
              value={jamsUrl}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setJamsUrl(event.target.value)}
              placeholder={t('enter_jams_server')}
              slotProps={{
                htmlInput: {
                  'aria-label': t('jams_url'),
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box
                        aria-hidden
                        sx={{
                          width: 20,
                          height: 20,
                          bgcolor: 'currentColor',
                          mask: `url(${jamiLogoIcon}) center / contain no-repeat`,
                          WebkitMask: `url(${jamiLogoIcon}) center / contain no-repeat`,
                          transition: 'background-color 240ms ease-in-out',
                          '@media (prefers-reduced-motion: reduce)': {
                            transition: 'none',
                          },
                        }}
                      />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <BaseButton variant="contained" type="submit" sx={{ alignSelf: 'flex-end' }}>
              {t('save_button')}
            </BaseButton>
          </Stack>
        </Form>
      </SettingsSection>
    </SettingsPage>
  )
}

export default JamsAuthMethod
