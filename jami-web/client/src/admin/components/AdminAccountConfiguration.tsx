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
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import PasswordField from '../../components/common/PasswordField.js'
import { DeleteIcon, PasswordIcon } from '../../components/SvgIcon.js'
import { SettingsPage, SettingsRow, SettingsSection } from '../../settings/components/SettingsPage.js'
import {
  useAdminDeletePasskeyMutation,
  useAdminPasskeyCredentialsQuery,
  useAdminRegisterPasskeyMutation,
  useUpdateAdminPasswordMutation,
} from '../services/adminQueries.js'

export default function AuthMethods() {
  const { t } = useTranslation()
  const [oldPassword, setOldPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [repeatPassword, setRepeatPassword] = useState<string>('')
  const passwordMutation = useUpdateAdminPasswordMutation()

  function validatePasswordChange() {
    if (
      newPassword !== repeatPassword ||
      oldPassword === newPassword ||
      newPassword === '' ||
      repeatPassword === '' ||
      oldPassword === ''
    ) {
      return
    }
    passwordMutation.mutate({ old: oldPassword, new: newPassword })
    setOldPassword('')
    setNewPassword('')
    setRepeatPassword('')
  }

  return (
    <SettingsPage title={t('admin_account_configuration')}>
      <SettingsSection
        title={t('setting_change_admin_password')}
        description={t('setting_change_admin_password_text')}
        list={false}
      >
        <Stack spacing={2}>
          <PasswordField
            label={t('admin_page_password_old_placeholder')}
            size="small"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
            startAdornment={<PasswordIcon />}
          />
          <PasswordField
            label={t('admin_page_password_placeholder')}
            size="small"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            startAdornment={<PasswordIcon />}
          />
          <PasswordField
            label={t('admin_page_password_repeat_placeholder')}
            size="small"
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
            autoComplete="new-password"
            startAdornment={<PasswordIcon />}
          />
          {newPassword !== repeatPassword && newPassword !== '' && repeatPassword !== '' && (
            <Typography variant="caption" color="error">
              {t('password_input_helper_text_not_match')}
            </Typography>
          )}
          <BaseButton
            variant="contained"
            type="submit"
            onClick={validatePasswordChange}
            disabled={
              oldPassword === '' ||
              newPassword === '' ||
              repeatPassword === '' ||
              newPassword !== repeatPassword ||
              oldPassword === newPassword
            }
            sx={{ alignSelf: 'flex-end' }}
          >
            {t('admin_page_password_submit')}
          </BaseButton>
        </Stack>
      </SettingsSection>
      {browserSupportsWebAuthn() && <AdminPasskeySection />}
    </SettingsPage>
  )
}

function AdminPasskeySection() {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')
  const { data: passkeys, isLoading } = useAdminPasskeyCredentialsQuery()
  const registerMutation = useAdminRegisterPasskeyMutation()
  const deleteMutation = useAdminDeletePasskeyMutation()

  const handleRegister = async () => {
    await registerMutation.mutateAsync(passkeyName || 'Passkey')
    setDialogOpen(false)
    setPasskeyName('')
  }

  return (
    <>
      <SettingsSection title={t('passkey_section_title')} description={t('passkey_section_description')}>
        {!isLoading &&
          (passkeys && passkeys.length > 0 ? (
            passkeys.map((pk) => (
              <SettingsRow
                key={pk.credentialId}
                title={pk.name}
                description={t('passkey_registered_on', {
                  date: new Date(pk.createdAt).toLocaleDateString(),
                })}
                control={
                  <IconButton
                    aria-label={t('remove_button')}
                    onClick={() => deleteMutation.mutate(pk.credentialId)}
                    disabled={deleteMutation.isPending}
                  >
                    <DeleteIcon />
                  </IconButton>
                }
              />
            ))
          ) : (
            <SettingsRow title={t('passkey_no_credentials')} />
          ))}
        <Stack sx={{ alignItems: 'flex-end', px: 2, py: 1.5 }}>
          <BaseButton
            variant="outlined"
            startIcon={<Fingerprint />}
            onClick={() => setDialogOpen(true)}
            disabled={registerMutation.isPending}
          >
            {t('passkey_register_button')}
          </BaseButton>
        </Stack>
      </SettingsSection>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{t('passkey_register_button')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('passkey_name_label')}
            placeholder={t('passkey_name_placeholder')}
            fullWidth
            value={passkeyName}
            onChange={(event) => setPasskeyName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <BaseButton variant="text" onClick={() => setDialogOpen(false)}>
            {t('dialog_cancel')}
          </BaseButton>
          <BaseButton onClick={handleRegister} disabled={registerMutation.isPending} variant="contained">
            {t('passkey_register_button')}
          </BaseButton>
        </DialogActions>
      </Dialog>
    </>
  )
}
