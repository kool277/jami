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
import { InputAdornment, Stack, Switch, TextField } from '@mui/material'
import { urlRegex } from '@savoirfairelinux/jami-web-common'
import { ChangeEvent, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, Navigate } from 'react-router-dom'

import BaseButton from '../../components/common/BaseButton.js'
import ProcessingRequest from '../../components/ProcessingRequest.js'
import { DnsIcon } from '../../components/SvgIcon.js'
import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { SettingsPage, SettingsSection } from '../../settings/components/SettingsPage.js'
import {
  useGetAdminConfigQuery,
  useGetNameServer,
  useResetNameServer,
  useSetNameServer,
  useUpdateAdminConfigMutation,
} from '../services/adminQueries.js'

const LocalAuthMethod = () => {
  const [accessToken] = useState(() => localStorage.getItem('adminAccessToken'))
  const { data } = useGetAdminConfigQuery()
  const nameserverSet = useGetNameServer()
  const nameServerConfigured = nameserverSet.data

  if (!accessToken) {
    return <Navigate to="/admin/login" replace />
  }

  if (data === undefined || nameServerConfigured === undefined) {
    return <ProcessingRequest open />
  }

  return <LocalAuthMethodForm key={nameServerConfigured} data={data} nameServerConfigured={nameServerConfigured} />
}

const LocalAuthMethodForm = ({
  data,
  nameServerConfigured,
}: {
  data: NonNullable<ReturnType<typeof useGetAdminConfigQuery>['data']>
  nameServerConfigured: string
}) => {
  const { t } = useTranslation()
  const saveAdminConfigMutation = useUpdateAdminConfigMutation()
  const [nameServer, setNameServer] = useState<string>(nameServerConfigured)
  const setNameServerMutation = useSetNameServer()
  const resetServerNameMutation = useResetNameServer()
  const { setAlertContent } = use(AlertSnackbarContext)

  const handleChange = () => {
    saveAdminConfigMutation.mutate({ localAuthEnabled: !data.localAuthEnabled })
  }

  const submitNewNameServer = async () => {
    if (urlRegex.test(nameServer) && nameServer !== nameServerConfigured) {
      setNameServerMutation.mutate(nameServer)
      setNameServer('')
    } else {
      setAlertContent({
        messageI18nKey: 'setting_name_server_error',
        severity: 'error',
        alertOpen: true,
      })
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitNewNameServer()
  }

  return (
    <SettingsPage
      title={t('jami_authentication')}
      description={t('jami_authentication_info')}
      headerEndAction={
        <Switch
          checked={data.localAuthEnabled}
          onChange={handleChange}
          slotProps={{ input: { 'aria-label': t('setting_auth_change', { authMethod: t('jami') }) } }}
        />
      }
    >
      <SettingsSection title={t('setting_name_server')} list={false}>
        <Form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <TextField
              id="name-server-input"
              fullWidth
              size="small"
              value={nameServer}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setNameServer(event.target.value)}
              slotProps={{
                htmlInput: {
                  'aria-label': t('setting_name_server'),
                },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <DnsIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Stack direction="row" sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
              <BaseButton variant="contained" type="button" onClick={() => resetServerNameMutation.mutate()}>
                {t('reset_nameserver_button')}
              </BaseButton>
              <BaseButton variant="contained" type="submit" disabled={nameServer === nameServerConfigured}>
                {t('save_button')}
              </BaseButton>
            </Stack>
          </Stack>
        </Form>
      </SettingsSection>
    </SettingsPage>
  )
}

export default LocalAuthMethod
