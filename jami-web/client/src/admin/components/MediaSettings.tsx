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

import { Switch, Typography } from '@mui/material'
import {
  ConferenceResolution,
  conferenceResolutionValues,
  defaultConferenceResolution,
} from '@savoirfairelinux/jami-web-common'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CustomSelect, type SelectOption } from '../../components/CustomSelect.js'
import ProcessingRequest from '../../components/ProcessingRequest.js'
import { useGetConferenceResolution } from '../../services/dataTransferQueries.js'
import { SettingsPage, SettingsRow, SettingsSection } from '../../settings/components/SettingsPage.js'
import {
  useGetAdminConfigQuery,
  useSetConferenceResolution,
  useUpdateAdminConfigMutation,
} from '../services/adminQueries.js'

export default function MediaSettings() {
  const conferenceResolutionData = useGetConferenceResolution()
  const noLocalMediaData = useGetAdminConfigQuery()

  if (conferenceResolutionData.data === undefined || conferenceResolutionData.isLoading) {
    return <ProcessingRequest open />
  }

  if (noLocalMediaData.data === undefined || noLocalMediaData.isLoading) {
    return <ProcessingRequest open />
  }

  const { data } = noLocalMediaData

  const configuredConferenceResolution = conferenceResolutionValues.includes(conferenceResolutionData.data.resolution)
    ? (conferenceResolutionData.data.resolution as ConferenceResolution)
    : defaultConferenceResolution

  return (
    <MediaSettingsForm
      key={`${data.noLocalMediaEnabled}-${configuredConferenceResolution}`}
      noLocalMediaEnabled={data.noLocalMediaEnabled}
      configuredConferenceResolution={configuredConferenceResolution}
    />
  )
}

const MediaSettingsForm = ({
  noLocalMediaEnabled,
  configuredConferenceResolution,
}: {
  noLocalMediaEnabled: boolean
  configuredConferenceResolution: ConferenceResolution
}) => {
  const { t } = useTranslation()
  const saveAdminConfigMutation = useUpdateAdminConfigMutation()
  const { mutate } = useSetConferenceResolution()
  const [conferenceResolution, setConferenceResolution] = useState<ConferenceResolution>(configuredConferenceResolution)

  const handleNoLocalMediaChange = () => {
    saveAdminConfigMutation.mutate({ noLocalMediaEnabled: !noLocalMediaEnabled })
  }

  const resolutionOptions: SelectOption<ConferenceResolution>[] = conferenceResolutionValues.map((resolution) => ({
    label: t(`conference_resolution_option_${resolution}`),
    payload: resolution,
  }))

  const handleConferenceResolutionChange = (option: SelectOption<ConferenceResolution> | null) => {
    if (!option) {
      return
    }

    const nextResolution = option.payload
    setConferenceResolution(nextResolution)
    if (nextResolution && nextResolution !== configuredConferenceResolution) {
      mutate(nextResolution)
    }
  }

  return (
    <SettingsPage title={t('media_settings')} description={t('media_settings_details')}>
      <SettingsSection list={false}>
        <SettingsRow
          title={t('no_local_media')}
          description={t('no_local_media_details')}
          control={<Switch checked={noLocalMediaEnabled} onChange={handleNoLocalMediaChange} />}
        />
        <SettingsRow
          title={t('conference_resolution')}
          description={t('conference_resolution_details')}
          control={
            <CustomSelect
              option={resolutionOptions.find((option) => option.payload === conferenceResolution)}
              options={resolutionOptions}
              onChange={handleConferenceResolutionChange}
              size="small"
            />
          }
        />
        <Typography color="text.secondary" variant="body2">
          {t('media_settings_restart_required')}
        </Typography>
      </SettingsSection>
    </SettingsPage>
  )
}
