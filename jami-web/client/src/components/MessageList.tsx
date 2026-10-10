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
import { Box, Stack } from '@mui/system'
import { Message, MESSAGES_NUMBER_TO_LOAD, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { useVirtualizer } from '@tanstack/react-virtual'
import { memo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InView } from 'react-intersection-observer'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import FilledIconButton from './common/FilledIconButton.js'
import { findNextVisibleMessage, findPreviousVisibleMessage, MessageRow } from './Message.js'
import { ArrowHeadDown } from './SvgIcon.js'

const MemoizedMessageRow = memo(MessageRow, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.body === nextProps.message.body &&
    prevProps.message.reactions === nextProps.message.reactions &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.editions === nextProps.message.editions &&
    prevProps.message['reply-to'] === nextProps.message['reply-to'] &&
    prevProps.isAccountMessage === nextProps.isAccountMessage &&
    prevProps.author === nextProps.author &&
    prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id
  )
})

interface MessageListProps {
  messages: Message[]
}

export default function MessageList({ messages }: MessageListProps) {
  const { account, accountId } = useAuthContext()
  const { members, conversationId } = useConversationContext()
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null)
  const webSocket = useWebSocketContext()
  const lastMessageId = messages[messages.length - 1]?.id
  const parentRef = useRef<HTMLDivElement>(null)

  const count = messages.length

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 20,
  })
  const items = virtualizer.getVirtualItems()

  const loadMoreMessages = () => {
    const args = {
      accountId,
      conversationId,
      lastMessageId,
      limit: MESSAGES_NUMBER_TO_LOAD,
    }
    webSocket.send(WebSocketMessageType.LoadMoreMessages, args)
  }

  const loadMessageGate = count - 5

  return (
    <>
      <Stack
        direction="column-reverse"
        data-testid="message-list"
        ref={setScrollContainer}
        sx={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 8px 8px 16px',
          marginBottom: '-25px',
          overflowX: 'hidden',
        }}
      >
        <InView
          as="span"
          root={scrollContainer}
          rootMargin="0px 0px 50px 0px"
          style={{ fontSize: 0 }}
          onChange={(inView) => setShowScrollButton(!inView)}
        />
        <Stack direction="column-reverse" ref={parentRef} sx={{ height: virtualizer.getTotalSize() }}>
          {
            // most recent messages first
            items.map((virtualItem) => {
              const index = virtualItem.index
              const message = messages[index]
              const previousMessage = findPreviousVisibleMessage(messages, index)
              const nextMessage = findNextVisibleMessage(messages, index)
              const isAccountMessage = message.author === account.getUri()
              let author
              if (isAccountMessage) {
                author = account
              } else {
                const member = members.find((member) => message.author === member.contact.uri)
                author = member?.contact
              }
              if (!author) {
                return null
              }
              const props = {
                message,
                isAccountMessage,
                author,
                previousMessage,
                nextMessage,
              }
              return (
                <Box key={message.id}>
                  <MemoizedMessageRow {...props} />
                  {index === loadMessageGate && (
                    <InView
                      as="span"
                      root={scrollContainer}
                      style={{ fontSize: 0 }}
                      onChange={(inView) => {
                        if (!inView) {
                          return
                        }
                        loadMoreMessages()
                      }}
                    />
                  )}
                </Box>
              )
            })
          }
        </Stack>
      </Stack>
      {showScrollButton && (
        <Box
          sx={{
            position: 'relative',
            bottom: '15px',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              transform: 'translate(-50%)',
              zIndex: 2,
            }}
          >
            <ScrollToEndButton scrollContainer={scrollContainer} />
          </Box>
        </Box>
      )}
    </>
  )
}

interface ScrollToEndButtonProps {
  scrollContainer: HTMLDivElement | null
}

const ScrollToEndButton = ({ scrollContainer }: ScrollToEndButtonProps) => {
  const { t } = useTranslation()

  return (
    <FilledIconButton
      aria-label={t('messages_scroll_to_end')}
      tooltip={t('messages_scroll_to_end')}
      onClick={() => scrollContainer?.scrollTo({ behavior: 'smooth', top: 0 })}
    >
      <ArrowHeadDown />
    </FilledIconButton>
  )
}
