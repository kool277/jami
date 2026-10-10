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

import { Box, ListItem, ListItemAvatar, ListItemText, useTheme } from '@mui/material'
import List from '@mui/material/List'
import { Fragment, memo, SetStateAction, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useBlockContactMutation,
  useContactListQuery,
  useContactQuery,
  useRemoveContactMutation,
} from '../services/contactQueries.js'
import ContactDetailDialog from './ContactDetailDialog.js'
import { ContactIdentity } from './ContactIdentity.js'
import ContactSearchBar from './ContactSearchBar.js'
import ContextMenu, { ContextMenuHandler, useContextMenuHandler } from './ContextMenu.js'
import ConversationAvatar from './ConversationAvatar.js'
import { ConfirmationDialog, useDialogHandler } from './Dialog.js'
import LoadingPage from './Loading.js'
import { PopoverListItemData } from './PopoverList.js'
import { BlockContactIcon, CancelIcon, PersonIcon } from './SvgIcon.js'

interface ContactListProps {
  members?: string[]
  selectedContacts?: string[]
  setSelectedContact?: (contact: string) => void
}

export default function ContactList({ setSelectedContact, selectedContacts, members }: ContactListProps) {
  const [currentContactId, setCurrentContactId] = useState<string>('')
  const [isBlocking, setIsBlocking] = useState(true)
  const [contactDetailDialogOpen, setContactDetailDialogOpen] = useState<boolean>(false)
  const contactListQuery = useContactListQuery()
  const { isLoading, data: contacts } = contactListQuery
  const [filterValue, setFilterValue] = useState('')
  const { t } = useTranslation()
  const singleContactQuery = useContactQuery(currentContactId)
  const { data: contactDetail } = singleContactQuery
  const contextMenuHandler = useContextMenuHandler()
  const theme = useTheme()

  const {
    props: { open: dialogOpen, onClose: closeContactDialog },
    openDialog: openContactDialog,
  } = useDialogHandler()

  const ContactDetailDialogElement = useMemo(() => {
    const onClosingContactDetailDialog = () => setContactDetailDialogOpen(false)
    return (
      <ContactDetailDialog
        contactDetail={contactDetail}
        open={contactDetailDialogOpen}
        onClose={onClosingContactDetailDialog}
      />
    )
  }, [contactDetail, contactDetailDialogOpen])

  const filteredContacts = useMemo(() => {
    const inSwarm: string[] = []
    if (members !== undefined) {
      for (const member of members) {
        inSwarm.push(member)
      }
    }
    const preFilter = contacts?.filter((contact) => !inSwarm.includes(contact.id))
    if (filterValue === '') {
      return preFilter
    }
    return preFilter?.filter((contact) => (contact.username ?? '').toLowerCase().includes(filterValue.toLowerCase()))
  }, [contacts, filterValue, members])

  const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterValue(event.target.value)
  }

  if (isLoading) {
    return <LoadingPage />
  }

  const isSelected = (contactId: string): boolean =>
    selectedContacts !== undefined && selectedContacts.includes(contactId)

  return (
    <>
      <ContactDialog
        isBlocking={isBlocking}
        open={dialogOpen}
        closeContactDialog={closeContactDialog}
        currentContactId={currentContactId}
      />
      {ContactDetailDialogElement}

      <ContactMenu
        contextMenuProps={contextMenuHandler.props}
        openContactDialog={openContactDialog}
        setIsBlocking={setIsBlocking}
        setContactDetailDialogOpen={setContactDetailDialogOpen}
      />
      <ContactSearchBar placeholder={t('find_contacts')} value={filterValue} handleChange={handleFilterChange} />
      <List sx={{ maxHeight: '400px', overflowY: 'scroll' }}>
        {filteredContacts?.map((contact) => (
          <Fragment key={contact.id}>
            <ListItem
              onClick={() => setSelectedContact && setSelectedContact(contact.id)}
              sx={{
                cursor: 'pointer',
                backgroundColor: isSelected(contact.id) ? theme.palette.primary.light : 'inherit',
                '&:hover': {
                  borderColor: theme.palette.primary.light,
                  textShadow: '0 0 .01px black',
                  backgroundColor: 'background.paper',
                },
                '&.Mui-selected': {
                  backgroundColor: theme.palette.primary.light,
                  color: theme.palette.primary.dark,
                  borderColor: theme.palette.primary.light,
                  textShadow: `0 0 .01px ${theme.palette.primary.light}`,
                },
              }}
              alignItems="flex-start"
              onContextMenu={(e) => {
                setCurrentContactId(contact.id)
                contextMenuHandler.handleAnchorPosition(e)
              }}
            >
              <ListItemAvatar>
                <ConversationAvatar
                  presence
                  contactUri={contact.id}
                  displayName={contact.displayName || contact.username || contact.id}
                />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <ContactIdentity
                    uri={contact.id}
                    displayName={contact.displayName}
                    registeredName={contact.username}
                  />
                }
              />
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  textAlign: 'center',
                  alignContent: 'center',
                  alignItems: 'center',
                  marginTop: '5%',
                  width: '24px',
                  height: '24px',
                }}
              ></Box>
            </ListItem>
          </Fragment>
        ))}
      </List>
      {filteredContacts !== undefined && filteredContacts.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', textAlign: 'center' }}>{t('no_countact_found')}</Box>
      )}
    </>
  )
}

interface ContactMenuProps {
  contextMenuProps: ContextMenuHandler['props']
  openContactDialog: () => void
  setIsBlocking: React.Dispatch<SetStateAction<boolean>>
  setContactDetailDialogOpen: React.Dispatch<SetStateAction<boolean>>
}

const ContactMenu = ({
  contextMenuProps,
  openContactDialog,
  setIsBlocking,
  setContactDetailDialogOpen,
}: ContactMenuProps) => {
  const { t } = useTranslation()
  const menuOptions: PopoverListItemData[] = useMemo(
    () => [
      {
        label: t('contact_details_text'),
        Icon: PersonIcon,
        onClick: () => {
          setContactDetailDialogOpen(true)
        },
      },
      {
        label: t('contact_block'),
        Icon: BlockContactIcon,
        onClick: () => {
          openContactDialog()
          setIsBlocking(true)
        },
      },
      {
        label: t('leave_conversation'),
        Icon: CancelIcon,
        onClick: () => {
          openContactDialog()
          setIsBlocking(false)
        },
      },
    ],
    [t, setIsBlocking, setContactDetailDialogOpen, openContactDialog],
  )
  return <ContextMenu {...contextMenuProps} items={menuOptions} />
}

interface ContactDialogProps {
  isBlocking: boolean
  open: boolean
  closeContactDialog: () => void
  currentContactId: string
}

const ContactDialog = memo(({ isBlocking, open, closeContactDialog, currentContactId }: ContactDialogProps) => {
  const removeContactMutation = useRemoveContactMutation()
  const blockContactMutation = useBlockContactMutation()

  const removeContact = (): void => {
    removeContactMutation.mutate(currentContactId)
    closeContactDialog()
  }

  const blockContact = (): void => {
    blockContactMutation.mutate(currentContactId)
    closeContactDialog()
  }

  const { t } = useTranslation()
  return (
    <ConfirmationDialog
      open={open}
      onClose={closeContactDialog}
      title={t('dialog_confirm_title_default')}
      content={isBlocking ? t('contact_ask_confirm_block') : t('contact_ask_confirm_remove')}
      onConfirm={isBlocking ? blockContact : removeContact}
      confirmButtonText={isBlocking ? t('contact_confirm_block') : t('contact_confirm_remove')}
    />
  )
})
