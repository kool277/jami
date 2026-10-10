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

import { Stack, TextField } from '@mui/material'
import { defaultAutoDownloadLimit } from '@savoirfairelinux/jami-web-common'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import ProcessingRequest from '../../components/ProcessingRequest.js'
import { SettingsBackupRestoreIcon } from '../../components/SvgIcon.js'
import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { useGetAutoDownloadLimit } from '../../services/dataTransferQueries.js'
import { SettingsPage, SettingsRow, SettingsSection } from '../../settings/components/SettingsPage.js'
import { useSetAutoDownloadLimit } from '../services/adminQueries.js'

export default function DownloadLimit() {
  const limitData = useGetAutoDownloadLimit()

  if (limitData.data === undefined || limitData.isLoading) {
    return <ProcessingRequest open />
  }

  return <DownloadLimitForm key={limitData.data.limit} configuredLimit={limitData.data.limit} />
}

const DownloadLimitForm = ({ configuredLimit }: { configuredLimit: number }) => {
  const [currentLimit, setCurrentLimit] = useState<number>(configuredLimit)
  const currentLimitRef = useRef<number>(configuredLimit)
  const savedLimitRef = useRef<number>(configuredLimit)
  const { setAlertContent } = use(AlertSnackbarContext)
  const { mutate, isPending } = useSetAutoDownloadLimit()
  const { t } = useTranslation()

  const handleLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextLimit = Number(event.target.value)
    setCurrentLimit(nextLimit)
    currentLimitRef.current = nextLimit
  }

  const saveIfNeeded = useCallback(
    (limit: number) => {
      if (limit === undefined || Number.isNaN(limit)) {
        return
      } else if (limit < 0) {
        setAlertContent({
          messageI18nKey: 'limit_cannot_be_negative',
          severity: 'error',
          alertOpen: true,
        })
        return
      } else if (limit === savedLimitRef.current) {
        return
      }
      mutate(limit, {
        onSuccess: () => {
          savedLimitRef.current = limit
        },
      })
    },
    [mutate, setAlertContent],
  )

  const resetToDefault = () => {
    setCurrentLimit(defaultAutoDownloadLimit)
    currentLimitRef.current = defaultAutoDownloadLimit
    saveIfNeeded(defaultAutoDownloadLimit)
  }

  useEffect(() => {
    return () => {
      saveIfNeeded(currentLimitRef.current)
    }
  }, [saveIfNeeded])

  return (
    <SettingsPage title={t('download_limit')} description={t('download_limit_details')}>
      <SettingsSection list={false}>
        <SettingsRow
          title={t('download_limit')}
          control={
            <TextField
              type="number"
              value={currentLimit}
              onChange={handleLimitChange}
              size="small"
              slotProps={{ htmlInput: { min: '0' } }}
            />
          }
        />
        <Stack direction="row" sx={{ alignSelf: 'flex-end' }}>
          <BaseButton
            variant="outlined"
            startIcon={<SettingsBackupRestoreIcon />}
            onClick={resetToDefault}
            disabled={currentLimit === defaultAutoDownloadLimit || isPending}
          >
            {t('reset_to_default')}
          </BaseButton>
        </Stack>
      </SettingsSection>
    </SettingsPage>
  )
}
