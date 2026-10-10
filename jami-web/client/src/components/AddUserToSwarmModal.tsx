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
import { use, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useAddMemberToSwarm } from '../services/conversationQueries.js'
import BaseButton from './common/BaseButton.js'
import BaseModalDialog from './common/BaseModalDialog.js'
import ContactList from './ContactList.js'

interface AddUserToSwarmModalProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export default function AddUserToSwarmModal({ open, setOpen }: AddUserToSwarmModalProps) {
  const { conversationId, members } = useConversationContext()
  const addMembers = useAddMemberToSwarm(conversationId)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const { t } = useTranslation()
  const { setAlertContent } = use(AlertSnackbarContext)

  const handleSelectedContact = (contact: string) => {
    if (selectedContacts.includes(contact)) {
      setSelectedContacts(selectedContacts.filter((item) => item !== contact))
    } else {
      setSelectedContacts([...selectedContacts, contact])
    }
  }

  const membersUris = members.map((member) => member.contact.uri)

  function addToSwarm() {
    if (selectedContacts.length === 0) {
      setAlertContent({
        messageI18nKey: 'add_to_group_no_user_selected',
        severity: 'error',
        alertOpen: true,
      })
      return
    }

    addMembers.mutate(selectedContacts)
    setSelectedContacts([])
    setOpen(false)
  }

  function handleClose() {
    setSelectedContacts([])
    setOpen(false)
  }

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={t('add_users_to_group')}
      onClose={handleClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      dialogWidth={400}
      actions={
        <BaseButton variant="contained" onClick={addToSwarm}>
          {t('add_to_group_validation')}
        </BaseButton>
      }
      contentSx={{ minHeight: 300 }}
    >
      <Box>
        <ContactList
          setSelectedContact={handleSelectedContact}
          selectedContacts={selectedContacts}
          members={membersUris}
        />
      </Box>
    </BaseModalDialog>
  )
}
