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
import { List, ListSubheader } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useUrlParams } from '../hooks/useUrlParams.js'
import { Contact } from '../models/contact.js'
import { PendingConversationRouteParams } from '../router.js'
import { useContactsSearchQuery, useJamsContactsSearchQuery } from '../services/contactQueries.js'
import { useConversationsSummariesQuery } from '../services/conversationQueries.js'
import { type ConversationFilter, filterConversationSummaries } from '../utils/conversationFilters.js'
import { pendingConversationPath } from '../utils/pendingConversation.js'
import { ContactIdentity } from './ContactIdentity.js'
import ConversationAvatar from './ConversationAvatar.js'
import { ConversationSummaryList } from './ConversationSummaryList.js'
import { CustomListItemButton } from './CustomListItemButton.js'
import LoadingPage from './Loading.js'

type ContactSearchResultListProps = {
  searchFilter: string
  conversationFilter: ConversationFilter
}

export default ({ searchFilter, conversationFilter }: ContactSearchResultListProps) => {
  const { t } = useTranslation()
  const {
    urlParams: { contactUri: selectedContactUri },
  } = useUrlParams<PendingConversationRouteParams>()

  const contactsSearchQuery = useContactsSearchQuery(searchFilter)
  const contactsJamsSearchQuery = useJamsContactsSearchQuery(searchFilter)

  const conversationsSummariesQuery = useConversationsSummariesQuery()

  const isLoading = contactsSearchQuery.isLoading && conversationsSummariesQuery.isLoading

  if (isLoading) {
    return <LoadingPage />
  }

  const conversationsSummaries = conversationsSummariesQuery.data
    ? filterConversationSummaries(conversationsSummariesQuery.data, conversationFilter)
    : undefined
  const contactsSearchResult = contactsSearchQuery.data
  const contactsJamsSearchResult = contactsJamsSearchQuery.data

  return (
    <List>
      <ListSubheader>{t('search_results')}</ListSubheader>

      {contactsSearchResult && contactsSearchResult.length > 0 && (
        <>
          {contactsSearchResult?.map((contact) => (
            <ContactSearchResultListItem
              key={contact.uri}
              contact={contact}
              selected={contact.uri === selectedContactUri}
            />
          ))}
        </>
      )}
      {contactsJamsSearchResult && contactsJamsSearchResult.length > 0 && (
        <>
          {contactsJamsSearchResult?.map((contact) => (
            <ContactSearchResultListItem
              key={contact.uri}
              contact={contact}
              selected={contact.uri === selectedContactUri}
            />
          ))}
        </>
      )}
      {conversationsSummaries && conversationsSummaries.length > 0 && (
        <>
          <ListSubheader>{t('conversations')}</ListSubheader>
          <ConversationSummaryList conversationsSummaries={conversationsSummaries} />
        </>
      )}
    </List>
  )
}

type ContactSearchResultListItemProps = {
  contact: Contact
  selected: boolean
}

const ContactSearchResultListItem = ({ contact, selected }: ContactSearchResultListItemProps) => {
  const navigate = useNavigate()

  return (
    <CustomListItemButton
      key={contact.uri}
      selected={selected}
      onClick={() =>
        navigate(pendingConversationPath(contact.uri), {
          state: {
            searchFilter: contact.registeredName || contact.uri,
          },
        })
      }
      icon={<ConversationAvatar contactUri={contact.uri} displayName={contact.getDisplayName()} />}
      primaryText={
        <ContactIdentity uri={contact.uri} displayName={contact.displayName} registeredName={contact.registeredName} />
      }
    />
  )
}
