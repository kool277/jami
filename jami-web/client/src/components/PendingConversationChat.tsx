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
import { Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useConversationContext } from '../contexts/ConversationProvider.js'
import EmptyState from './common/EmptyState.js'
import ConversationAvatar from './ConversationAvatar.js'
import FilePreviewsList from './FilePreviewsList.js'
import SendMessageForm from './SendMessageForm.js'

interface PendingConversationChatProps {
  openFilePicker: () => void
}

/**
 * The chat surface of a peer that has not been invited yet. There is no swarm to
 * read messages from, so the message list is replaced by an explanation that the
 * first message doubles as the invitation.
 */
export default function PendingConversationChat({ openFilePicker }: PendingConversationChatProps) {
  const { t } = useTranslation()
  const { pendingContact, conversationDisplayName } = useConversationContext()

  return (
    <>
      <Stack sx={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
        <EmptyState
          icon={
            pendingContact && (
              <ConversationAvatar
                displayName={conversationDisplayName}
                contactUri={pendingContact.uri}
                sx={{ width: 96, height: 96, fontSize: '2rem' }}
              />
            )
          }
          title={conversationDisplayName}
          description={t('pending_conversation_description')}
        />
      </Stack>
      <FilePreviewsList />
      <SendMessageForm openFilePicker={openFilePicker} />
    </>
  )
}
