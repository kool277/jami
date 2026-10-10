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

import { Box, TextField } from '@mui/material'
import { Message } from '@savoirfairelinux/jami-web-common'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTransferMessageMutation } from '../services/conversationQueries.js'
import { useTransferFileMutation } from '../services/dataTransferQueries.js'
import BaseIconButton from './common/BaseIconButton.js'
import BaseModalDialog from './common/BaseModalDialog.js'
import { SelectConversationList } from './SelectConversationList.js'
import { Arrow2Icon } from './SvgIcon.js'

interface TransferMessageProps {
  conversationId: string
  message: Message
  onClose: () => void
  open: boolean
}

const TransferMessage = ({ conversationId, message, onClose, open }: TransferMessageProps) => {
  const { t } = useTranslation()

  const [comment, setComment] = useState<string>('')
  const [selectedConversations, setSelectedConversations] = useState<string[]>([])

  const messageBody = message.body
  const isFile = message?.type === 'application/data-transfer+json'

  const transferMessageMutation = useTransferMessageMutation(conversationId)
  const transferFileMutation = useTransferFileMutation(conversationId)

  const selectConversation = (contact: string) => {
    if (selectedConversations.includes(contact)) {
      setSelectedConversations(selectedConversations.filter((c) => c !== contact))
      return
    }
    setSelectedConversations([...selectedConversations, contact])
  }

  const handleTransfer = () => {
    if (!selectedConversations || selectedConversations.length === 0) {
      return
    }

    if (!isFile) {
      transferMessageMutation.mutate({ messageBody, targetedConversations: selectedConversations, comment })
      onClose()
      return
    }

    const fileName = message?.displayName
    const fileId = message?.fileId

    if (!fileId || !fileName) {
      console.error('FileId or fileName is missing')
      return
    }

    transferFileMutation.mutate({
      conversationId,
      fileId,
      fileName,
      targetedConversations: selectedConversations,
      comment,
    })
    onClose()
  }

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={t('transfer_message')}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      dialogWidth={350}
      actions={
        <BaseIconButton
          aria-label={t('transfer_message')}
          tooltip={t('transfer_message')}
          disabled={selectedConversations.length === 0}
          onClick={handleTransfer}
        >
          <Arrow2Icon />
        </BaseIconButton>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box
          sx={{
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          <SelectConversationList
            selectedConversationIds={selectedConversations}
            onSelectConversation={selectConversation}
          />
        </Box>

        <TextField
          fullWidth
          maxRows={1}
          placeholder={t('add_comment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Box>
    </BaseModalDialog>
  )
}

export default TransferMessage
