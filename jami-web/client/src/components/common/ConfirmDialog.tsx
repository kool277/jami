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
import { Typography } from '@mui/material'

import BaseButton from './BaseButton.js'
import BaseModalDialog from './BaseModalDialog.js'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={title}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      actions={
        <>
          <BaseButton variant="outlined" onClick={onClose}>
            {cancelLabel}
          </BaseButton>
          <BaseButton variant="contained" color={destructive ? 'error' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </BaseButton>
        </>
      }
    >
      <Typography>{description}</Typography>
    </BaseModalDialog>
  )
}
