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
import { Alert, IconButton, InputAdornment, Stack, TextField, Tooltip } from '@mui/material'
import axios from 'axios'
import { FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import BaseModalDialog from '../../components/common/BaseModalDialog.js'
import { InfoIcon, PasswordIcon, PersonIcon } from '../../components/SvgIcon.js'
import { jamiUsernamePattern } from '../../utils/constants.js'
import { useCheckAdminUsernameAvailabilityQuery } from '../services/adminQueries.js'

interface AdminAccountDialogProps {
  open: boolean
  mode: 'create' | 'reset-password'
  onClose: () => void
  onSubmit: (values: { username?: string; password: string }) => Promise<unknown>
  pending: boolean
}

export default function AdminAccountDialog({ open, mode, onClose, onSubmit, pending }: AdminAccountDialogProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitError, setSubmitError] = useState<string>()
  const isCreate = mode === 'create'
  const usernameInvalid = isCreate && username.length > 0 && !jamiUsernamePattern.test(username)
  const usernameAvailability = useCheckAdminUsernameAvailabilityQuery(isCreate ? username : '')
  const usernameTaken = usernameAvailability.data === 'taken'
  const usernameUnavailable = usernameAvailability.data === 'invalid'
  const usernameAvailable = usernameAvailability.data === 'available'
  const usernameError = usernameInvalid || usernameTaken || usernameUnavailable
  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordMismatch = confirmation !== '' && confirmation !== password
  const canSubmit =
    !pending &&
    password.length >= 8 &&
    confirmation === password &&
    (!isCreate || (!usernameError && usernameAvailable && !usernameAvailability.isFetching))

  const usernameHelperText =
    usernameInvalid || usernameUnavailable
      ? t('username_input_helper_text_invalid')
      : usernameTaken
        ? t('username_input_helper_text_taken')
        : undefined

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    try {
      await onSubmit({ username: isCreate ? username.trim() : undefined, password })
    } catch (error) {
      setSubmitError(
        axios.isAxiosError(error) && typeof error.response?.data === 'string'
          ? error.response.data
          : error instanceof Error
            ? error.message
            : t('unknown_error_alert'),
      )
    }
  }

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={t(isCreate ? 'admin_account_add' : 'change_password')}
      onClose={() => {
        setUsername('')
        setPassword('')
        setConfirmation('')
        setSubmitError(undefined)
        onClose()
      }}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      dialogWidth={400}
      contentSx={{ '&.MuiDialogContent-root': { pt: 1.5 } }}
      actions={
        <>
          <BaseButton onClick={onClose} disabled={pending}>
            {t('dialog_cancel')}
          </BaseButton>
          <BaseButton form="admin-account-form" type="submit" disabled={!canSubmit}>
            {t(isCreate ? 'admin_account_create' : 'change_password')}
          </BaseButton>
        </>
      }
    >
      <Stack component="form" id="admin-account-form" spacing={2} onSubmit={handleSubmit}>
        {submitError && <Alert severity="error">{submitError}</Alert>}
        {isCreate && (
          <TextField
            autoFocus
            required
            size="small"
            label={t('admin_page_accounts_overview_title_username')}
            value={username}
            slotProps={{
              inputLabel: {
                sx: {
                  bgcolor: 'background.paper',
                  mx: -0.5,
                  px: 0.5,
                },
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={t('admin_account_username_nameserver_info')}>
                      <IconButton aria-label={t('admin_account_username_nameserver_info')} edge="end" size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
            onChange={(event) => setUsername(event.target.value)}
            error={usernameError}
            helperText={usernameHelperText}
          />
        )}
        <TextField
          required
          type="password"
          size="small"
          label={t(isCreate ? 'password_input_label' : 'admin_page_password_placeholder')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={passwordTooShort}
          helperText={passwordTooShort ? t('password_input_helper_text_too_short') : undefined}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PasswordIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          required
          type="password"
          size="small"
          label={t(isCreate ? 'password_input_label_repeat' : 'admin_page_password_repeat_placeholder')}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          error={passwordMismatch}
          helperText={passwordMismatch ? t('password_input_helper_text_not_match') : undefined}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <PasswordIcon />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>
    </BaseModalDialog>
  )
}
