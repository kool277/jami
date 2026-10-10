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
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import { type Theme } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import { type SystemStyleObject } from '@mui/system'
import { type ReactNode, useId } from 'react'

export type ModalClosePolicy = 'escapeKeyDown' | 'backdropClick' | 'none'

type AccessibleDialogName = { title: string; 'aria-label'?: never } | { title?: undefined; 'aria-label': string }

export type BaseModalDialogProps = {
  open: boolean
  selectedValue: string
  titleIcon?: ReactNode
  titleSuffix?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  onClose: (value: string) => void
  closePolicy?: ModalClosePolicy | ModalClosePolicy[]
  dialogWidth?: number | string
  nonModal?: boolean
  paperId?: string
  paperSx?: SystemStyleObject<Theme>
  contentSx?: SystemStyleObject<Theme>
} & AccessibleDialogName

export default function BaseModalDialog(props: BaseModalDialogProps) {
  const {
    onClose,
    selectedValue,
    open,
    title,
    'aria-label': ariaLabel,
    titleIcon,
    titleSuffix,
    children,
    actions,
    closePolicy = 'escapeKeyDown',
    dialogWidth,
    nonModal = false,
    paperId,
    paperSx,
    contentSx,
  } = props
  const titleId = useId()

  const handleClose = () => {
    onClose(selectedValue)
  }

  const handleDialogClose: NonNullable<DialogProps['onClose']> = (_, reason) => {
    if (closePolicy === reason || (Array.isArray(closePolicy) && closePolicy.includes(reason))) {
      handleClose()
    }
  }

  return (
    <Dialog
      aria-labelledby={title != null ? titleId : undefined}
      aria-modal={nonModal ? false : undefined}
      disableAutoFocus={nonModal}
      disableEnforceFocus={nonModal}
      disableRestoreFocus={nonModal}
      disableScrollLock={nonModal}
      hideBackdrop={nonModal}
      onClose={handleDialogClose}
      open={open}
      slotProps={{
        root: nonModal
          ? {
              sx: {
                pointerEvents: 'none',
              },
            }
          : undefined,
        paper: {
          'aria-label': ariaLabel,
          id: paperId,
          sx: {
            backgroundColor: 'background.paper',
            backgroundImage: 'none',
            ...(dialogWidth != null && { maxWidth: 'calc(100% - 64px)', width: dialogWidth }),
            ...(nonModal && { pointerEvents: 'auto' }),
            ...paperSx,
          },
        },
      }}
    >
      {title != null && (
        <DialogTitle id={titleId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          {titleIcon}
          <Typography component="span" noWrap sx={{ display: 'block' }}>
            {title}
          </Typography>
          {titleSuffix}
        </DialogTitle>
      )}
      {children != null && (
        <DialogContent
          sx={{
            boxSizing: 'border-box',
            minWidth: 0,
            overflowWrap: 'anywhere',
            overflowX: 'hidden',
            '& > *': { boxSizing: 'border-box', maxWidth: '100%', minWidth: 0 },
            ...contentSx,
          }}
        >
          {children}
        </DialogContent>
      )}
      {actions != null && (
        <DialogActions
          sx={{
            boxSizing: 'border-box',
            width: '100%',
            '& > .MuiButton-root': { flex: 1 },
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  )
}
