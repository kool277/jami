/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField } from '@mui/material'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../../components/common/BaseButton.js'
import { DeleteIcon } from '../../../components/SvgIcon.js'
import {
  useDeletePasskeyMutation,
  usePasskeyCredentialsQuery,
  useRegisterPasskeyMutation,
} from '../../../services/passkeyQueries.js'
import { SettingsRow, SettingsSection } from '../SettingsPage.js'

export default function PasskeyManager() {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [passkeyName, setPasskeyName] = useState('')
  const { data: passkeys, isLoading } = usePasskeyCredentialsQuery()
  const registerMutation = useRegisterPasskeyMutation()
  const deleteMutation = useDeletePasskeyMutation()

  if (!browserSupportsWebAuthn()) {
    return (
      <SettingsSection title={t('passkey_section_title')} description={t('passkey_section_description')}>
        <SettingsRow title={t('passkey_not_available')} />
      </SettingsSection>
    )
  }

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
            passkeys.map((passkey) => (
              <SettingsRow
                key={passkey.credentialId}
                title={passkey.name}
                description={t('passkey_registered_on', { date: new Date(passkey.createdAt).toLocaleDateString() })}
                control={
                  <IconButton
                    aria-label={t('remove_button')}
                    onClick={() => deleteMutation.mutate(passkey.credentialId)}
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
