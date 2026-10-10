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

import { Box } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form } from 'react-router-dom'

import BaseButton from '../../../components/common/BaseButton.js'
import BaseModalDialog from '../../../components/common/BaseModalDialog.js'
import PasswordField from '../../../components/common/PasswordField.js'
import { useAuthContext } from '../../../contexts/AuthProvider.js'

interface PasswordRequiredModalProps {
  open: boolean
  onClose: () => void
  onValidation: (password: string) => void
  title: string
  buttonText: string
  info?: string
}

export default function PasswordRequiredModal({
  open,
  onClose,
  onValidation,
  title,
  buttonText,
  info,
}: PasswordRequiredModalProps) {
  const [password, setPassword] = useState<string>('')
  const { t } = useTranslation()
  const { account } = useAuthContext()
  const hasPassword = account.details['Account.archiveHasPassword']

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={title}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      dialogWidth={400}
      actions={
        <>
          <BaseButton variant="contained" onClick={onClose}>
            {t('dialog_cancel')}
          </BaseButton>
          <BaseButton variant="contained" onClick={() => onValidation(password)}>
            {buttonText}
          </BaseButton>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 240 }}>
        {hasPassword && <Box sx={{ typography: 'body2', color: 'text.secondary' }}>{t('enter_password_info')}</Box>}
        {info && (
          <Box
            sx={{
              typography: 'body2',
              color: 'text.secondary',
              overflowWrap: 'anywhere',
              whiteSpace: 'pre-wrap',
            }}
          >
            {info}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Form method="post" style={{ visibility: hasPassword ? 'visible' : 'hidden' }}>
            <PasswordField
              label={t('password_input_label')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form>
        </Box>
      </Box>
    </BaseModalDialog>
  )
}
