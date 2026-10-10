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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import EmptyState from '../components/common/EmptyState.js'
import InviteDetailSkeleton from '../components/common/InviteDetailSkeleton.js'
import InviteList from '../components/InviteList.js'
import AppShell from '../components/shell/AppShell.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useConversationRequestsQuery } from '../services/conversationQueries.js'

export default function Invites() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const conversationRequestsQuery = useConversationRequestsQuery()
  useDocumentTitle(t('invitations'))

  useEffect(() => {
    const firstInvitation = conversationRequestsQuery.data?.[0]
    if (location.pathname === '/invites' && firstInvitation) {
      navigate(`/invites/${firstInvitation.conversationId}`, { replace: true })
    }
  }, [conversationRequestsQuery.data, location.pathname, navigate])

  return (
    <AppShell
      listRoute="/invites"
      listPaneLabel={t('invitations')}
      listPane={<InviteList />}
      placeholder={
        conversationRequestsQuery.isPending ? <InviteDetailSkeleton /> : <EmptyState title={t('invitations_select')} />
      }
      detailLoadingFallback={<InviteDetailSkeleton />}
    />
  )
}
