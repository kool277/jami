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
import { Box, Stack } from '@mui/material'
import { WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { type UIEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { useConversationsSummariesQuery, useRefreshConversationsSummaries } from '../services/conversationQueries.js'
import { type ConversationFilter, filterConversationSummaries } from '../utils/conversationFilters.js'
import { ISLAND_PADDING } from './common/Island.js'
import ListPaneEmptyState from './common/ListPaneEmptyState.js'
import ContactSearchResultList from './ContactSearchResultList.js'
import { ConversationSummaryList } from './ConversationSummaryList.js'

export interface ConversationListProps {
  /** Owned by the shell, since the search bar belongs to the island rather than the list. */
  searchFilter?: string
  conversationFilter: ConversationFilter
}

const SCROLL_FADE_HEIGHT = 24
const SCROLL_EDGE_TOLERANCE = 1

export function getConversationListFades(scrollTop: number, clientHeight: number, scrollHeight: number) {
  const maxScrollTop = scrollHeight - clientHeight
  const isScrollable = maxScrollTop > SCROLL_EDGE_TOLERANCE

  return {
    top: isScrollable && scrollTop > SCROLL_EDGE_TOLERANCE,
    bottom: isScrollable && scrollTop < maxScrollTop - SCROLL_EDGE_TOLERANCE,
  }
}

export const conversationSummaryRefreshEvents = [
  WebSocketMessageType.ConversationMessage,
  WebSocketMessageType.ConversationReady,
]

export default function ConversationList({ searchFilter, conversationFilter }: ConversationListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [fades, setFades] = useState({ top: false, bottom: false })
  const updateFades = useCallback(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      setFades(
        getConversationListFades(scrollContainer.scrollTop, scrollContainer.clientHeight, scrollContainer.scrollHeight),
      )
    }
  }, [])

  useEffect(() => {
    updateFades()

    const scrollContainer = scrollContainerRef.current
    const content = contentRef.current
    if (!scrollContainer || !content) {
      return
    }

    const resizeObserver = new ResizeObserver(updateFades)
    resizeObserver.observe(scrollContainer)
    resizeObserver.observe(content)
    return () => resizeObserver.disconnect()
  }, [updateFades])

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
    setFades(getConversationListFades(scrollTop, clientHeight, scrollHeight))
  }

  return (
    <Stack sx={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 0 }}>
      <Stack ref={scrollContainerRef} onScroll={handleScroll} sx={{ overflowY: 'auto', flex: 1, pr: ISLAND_PADDING }}>
        <Box ref={contentRef} sx={{ flexShrink: 0 }}>
          {searchFilter ? (
            <ContactSearchResultList searchFilter={searchFilter} conversationFilter={conversationFilter} />
          ) : (
            <ConversationSummaries conversationFilter={conversationFilter} />
          )}
        </Box>
      </Stack>
      <ScrollFade position="top" visible={fades.top} />
      <ScrollFade position="bottom" visible={fades.bottom} />
    </Stack>
  )
}

function ScrollFade({ position, visible }: { position: 'top' | 'bottom'; visible: boolean }) {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top: position === 'top' ? 0 : undefined,
        bottom: position === 'bottom' ? 0 : undefined,
        right: 0,
        left: 0,
        height: SCROLL_FADE_HEIGHT,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: (theme) => theme.transitions.create('opacity'),
        background: (theme) =>
          `linear-gradient(to ${position === 'top' ? 'bottom' : 'top'}, ${theme.palette.background.paper}, transparent)`,
      }}
    />
  )
}

const ConversationSummaries = ({ conversationFilter }: Pick<ConversationListProps, 'conversationFilter'>) => {
  const conversationsSummariesQuery = useConversationsSummariesQuery()
  const conversationsSummaries = conversationsSummariesQuery.data || []
  const websocket = useWebSocketContext()
  const refreshConversationsSummaries = useRefreshConversationsSummaries()

  useEffect(() => {
    conversationSummaryRefreshEvents.forEach((eventType) => websocket.bind(eventType, refreshConversationsSummaries))
    return () => {
      conversationSummaryRefreshEvents.forEach((eventType) =>
        websocket.unbind(eventType, refreshConversationsSummaries),
      )
    }
  }, [websocket, refreshConversationsSummaries])

  const filteredConversations = filterConversationSummaries(conversationsSummaries, conversationFilter)

  if (conversationsSummariesQuery.isSuccess) {
    const emptyState = getEmptyConversationState(
      conversationFilter,
      conversationsSummaries.length,
      filteredConversations.length,
    )
    if (emptyState === 'unread') {
      return <EmptyUnreadConversations />
    }
    if (emptyState === 'groups') {
      return <EmptyGroupsConversations />
    }
    if (emptyState === 'conversations') {
      return <EmptyConversations />
    }
  }

  return <ConversationSummaryList conversationsSummaries={filteredConversations} />
}

export function getEmptyConversationState(
  conversationFilter: ConversationFilter,
  conversationCount: number,
  filteredConversationCount: number,
) {
  if (filteredConversationCount === 0 && (conversationFilter === 'unread' || conversationFilter === 'groups')) {
    return conversationFilter
  }
  if (conversationCount === 0) {
    return 'conversations'
  }
  return undefined
}

export function EmptyConversations() {
  const { t } = useTranslation()

  return (
    <EmptyConversationState
      src="/jami-tumbleweed.svg"
      imageWidth={200}
      title={t('conversation_empty_title')}
      description={t('conversation_empty_description')}
    />
  )
}

export function EmptyUnreadConversations() {
  const { t } = useTranslation()

  return (
    <EmptyConversationState
      src="/no-unread-messages.svg"
      imageWidth={44}
      imageHeight={44}
      title={t('conversation_no_unread_title')}
      description={t('conversation_no_unread_description')}
    />
  )
}

export function EmptyGroupsConversations() {
  const { t } = useTranslation()

  return (
    <EmptyConversationState
      src="/no-groups.svg"
      imageWidth={58}
      imageHeight={58}
      title={t('conversation_no_groups_title')}
      description={t('conversation_no_groups_description')}
    />
  )
}

interface EmptyConversationStateProps {
  src: string
  imageWidth: number
  imageHeight?: number
  title: string
  description: string
}

function EmptyConversationState({ src, imageWidth, imageHeight, title, description }: EmptyConversationStateProps) {
  return (
    <ListPaneEmptyState
      icon={
        <Box
          component="img"
          src={src}
          alt=""
          sx={{
            width: imageWidth,
            height: imageHeight,
            maxWidth: '100%',
            opacity: 0.66,
            filter: (theme) => (theme.palette.mode === 'dark' ? 'invert(1)' : undefined),
          }}
        />
      }
      title={title}
      description={description}
    />
  )
}
