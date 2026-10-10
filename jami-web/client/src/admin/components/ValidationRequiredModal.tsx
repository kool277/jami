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
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import BaseModalDialog from '../../components/common/BaseModalDialog.js'

interface ValidationRequiredModalProps {
  open: boolean
  onClose: () => void
  onValidation: () => void
  title: string
  buttonText: string
  info?: string
}

export default function ValidationRequiredModal({
  open,
  onClose,
  onValidation,
  title,
  buttonText,
  info,
}: ValidationRequiredModalProps) {
  const { t } = useTranslation()

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={title}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      dialogWidth={350}
      actions={
        <>
          <BaseButton variant="text" onClick={onClose}>
            {t('dialog_cancel')}
          </BaseButton>
          <BaseButton color="error" variant="contained" onClick={onValidation}>
            {buttonText}
          </BaseButton>
        </>
      }
    >
      {info && (
        <Box
          sx={{
            typography: 'body2',
            color: 'text.secondary',
            overflowWrap: 'anywhere',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
          }}
        >
          {info}
        </Box>
      )}
    </BaseModalDialog>
  )
}
