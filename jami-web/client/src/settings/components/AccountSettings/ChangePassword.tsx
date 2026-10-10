/*
 * Copyright (C) 2026 Savoir-faire Linux Inc.
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
import { HttpStatusCode, MIN_PASSWORD_LENGTH } from '@savoirfairelinux/jami-web-common'
import axios from 'axios'
import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../../components/common/BaseButton.js'
import PasswordField from '../../../components/common/PasswordField.js'
import { PasswordIcon } from '../../../components/SvgIcon.js'
import { useUpdateAccountPasswordMutation } from '../../../services/accountQueries.js'

export default function ChangePassword() {
  const { t } = useTranslation()
  const passwordMutation = useUpdateAccountPasswordMutation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submissionError, setSubmissionError] = useState<string>()

  const passwordsMatch = newPassword === confirmation
  const isNewPasswordValid =
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    passwordsMatch &&
    newPassword !== currentPassword &&
    currentPassword !== ''

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isNewPasswordValid) {
      return
    }

    setSubmissionError(undefined)
    passwordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('')
          setNewPassword('')
          setConfirmation('')
        },
        onError: (error) => {
          if (axios.isAxiosError(error) && error.response?.status === HttpStatusCode.Conflict) {
            setSubmissionError(t('change_password_incorrect_current'))
            return
          }
          setSubmissionError(t('change_password_request_failed'))
        },
      },
    )
  }

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit}>
      <PasswordField
        autoComplete="current-password"
        label={t('change_password_current_label')}
        required
        size="small"
        startAdornment={<PasswordIcon />}
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <PasswordField
        autoComplete="new-password"
        label={t('change_password_new_label')}
        required
        size="small"
        startAdornment={<PasswordIcon />}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <PasswordField
        autoComplete="new-password"
        label={t('change_password_confirmation_label')}
        required
        size="small"
        startAdornment={<PasswordIcon />}
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      {newPassword !== '' && newPassword.length < MIN_PASSWORD_LENGTH && (
        <Typography color="error" variant="caption">
          {t('password_input_helper_text_too_short')}
        </Typography>
      )}
      {confirmation !== '' && !passwordsMatch && (
        <Typography color="error" variant="caption">
          {t('password_input_helper_text_not_match')}
        </Typography>
      )}
      {newPassword !== '' && newPassword === currentPassword && (
        <Typography color="error" variant="caption">
          {t('change_password_must_differ')}
        </Typography>
      )}
      {submissionError && (
        <Typography color="error" role="alert" variant="caption">
          {submissionError}
        </Typography>
      )}
      <BaseButton disabled={!isNewPasswordValid || passwordMutation.isPending} type="submit" variant="contained">
        {t('change_password_action')}
      </BaseButton>
    </Stack>
  )
}
