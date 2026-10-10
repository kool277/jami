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

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useRemoveConversationMutation } from '../services/conversationQueries.js'
import { ConfirmationDialog } from './Dialog.js'

interface RemoveConversationDialogProps {
  conversationId: string
  isCurrent: boolean
  open: boolean
  onClose: () => void
}

const RemoveConversationDialog = ({ conversationId, isCurrent, open, onClose }: RemoveConversationDialogProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const removeConversationMutation = useRemoveConversationMutation()

  const remove = useCallback(async () => {
    removeConversationMutation.mutate(
      { conversationId },
      {
        onSuccess: () => {
          if (isCurrent) {
            navigate('/conversation/')
          }
        },
        onError: (e) => {
          console.error(`Error removing conversation : `, e)
        },
        onSettled: () => {
          onClose()
        },
      },
    )
  }, [conversationId, isCurrent, navigate, onClose, removeConversationMutation])

  return (
    <ConfirmationDialog
      open={open}
      onClose={onClose}
      title={t('dialog_confirm_title_default')}
      content={t('conversation_ask_confirm_remove')}
      onConfirm={remove}
      confirmButtonText={t('conversation_confirm_remove')}
    />
  )
}

export default RemoveConversationDialog
