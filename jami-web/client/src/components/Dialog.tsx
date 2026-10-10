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
import { Box, List, ListItem, ListItemIcon, Stack, SvgIconProps, Typography } from '@mui/material'
import { ComponentType, ReactNode, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from './common/BaseButton.js'
import BaseModalDialog from './common/BaseModalDialog.js'

interface DialogHandler {
  props: {
    open: boolean
    onClose: () => void
  }
  openDialog: () => void
}

export const useDialogHandler = (): DialogHandler => {
  const [open, setOpen] = useState(false)

  const onClose = useCallback(() => {
    setOpen(false)
  }, [])

  const openDialog = useCallback(() => {
    setOpen(true)
  }, [])

  return useMemo(
    () => ({
      props: { open, onClose },
      openDialog,
    }),
    [open, onClose, openDialog],
  )
}

interface BaseDialogProps {
  open: boolean
  onClose: () => void
  icon?: ReactNode
  title: string
  content: ReactNode
  actions: ReactNode
}

export const BaseDialog = ({ open, onClose, icon, title, content, actions }: BaseDialogProps) => {
  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={title}
      titleIcon={icon}
      actions={actions}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
    >
      {content}
    </BaseModalDialog>
  )
}

type InfosDialogProps = Omit<BaseDialogProps, 'actions'>

export const InfosDialog = (props: InfosDialogProps) => {
  const { t } = useTranslation()
  return (
    <BaseDialog
      {...props}
      actions={
        <BaseButton variant="text" onClick={props.onClose} autoFocus>
          {t('dialog_close')}
        </BaseButton>
      }
    />
  )
}

interface ConfirmationDialogProps extends Omit<BaseDialogProps, 'actions'> {
  onConfirm: () => void
  confirmButtonText: string
  content: string
}

export const ConfirmationDialog = ({ onConfirm, confirmButtonText, ...props }: ConfirmationDialogProps) => {
  const { t } = useTranslation()
  const title = props.title || t('dialog_confirm_title_default')

  return (
    <BaseDialog
      {...props}
      title={title}
      content={<Typography variant="body1">{props.content}</Typography>}
      actions={
        <>
          <BaseButton variant="text" onClick={onConfirm}>
            {confirmButtonText}
          </BaseButton>
          <BaseButton variant="text" onClick={props.onClose}>
            {t('dialog_cancel')}
          </BaseButton>
        </>
      }
    />
  )
}

interface DialogContentListItem {
  Icon?: ComponentType<SvgIconProps>
  label?: string
  value: ReactNode
}

interface DialogContentListProps {
  title?: string
  items: DialogContentListItem[]
}

export const DialogContentList = ({ title, items }: DialogContentListProps) => {
  return (
    <List subheader={<Typography variant="h3">{title}</Typography>}>
      {items.map(({ Icon, label, value }) => (
        <ListItem key={label ?? String(value)}>
          {Icon && (
            <ListItemIcon>
              <Icon />
            </ListItemIcon>
          )}
          <Stack
            direction="row"
            spacing="24px"
            sx={{
              alignItems: 'center',
            }}
          >
            {label && (
              <Stack
                direction="row"
                sx={{
                  width: '100px',
                  justifyContent: 'end',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: '#a0a0a0',
                  }}
                >
                  {label}
                </Typography>
              </Stack>
            )}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {value}
              </Typography>
            </Box>
          </Stack>
        </ListItem>
      ))}
    </List>
  )
}
