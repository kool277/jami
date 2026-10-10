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
import { Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useConversationRequestsQuery } from '../services/conversationQueries.js'
import ListPaneEmptyState from './common/ListPaneEmptyState.js'
import LoadingSkeleton from './common/LoadingSkeleton.js'
import { ConversationRequestList } from './ConversationRequestList.js'
import { MailIcon } from './SvgIcon.js'

/** The list pane of the invites destination: pending conversation requests. */
export default function InviteList() {
  const { t } = useTranslation()
  const conversationRequestsQuery = useConversationRequestsQuery()

  return (
    <Stack sx={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
      <Typography variant="h3" sx={{ px: 2, pt: { xs: 2, md: 1 }, pb: 1 }}>
        {t('invitations')}
      </Typography>
      {conversationRequestsQuery.isPending ? (
        <LoadingSkeleton lines={3} />
      ) : conversationRequestsQuery.data?.length ? (
        <ConversationRequestList />
      ) : (
        <EmptyInvitations />
      )}
    </Stack>
  )
}

export function EmptyInvitations() {
  const { t } = useTranslation()

  return (
    <ListPaneEmptyState
      icon={<MailIcon sx={{ fontSize: 48, color: 'text.secondary' }} />}
      title={t('invitations_empty')}
      description={t('invitations_empty_description')}
    />
  )
}
