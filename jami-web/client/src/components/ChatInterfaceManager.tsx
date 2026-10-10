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
import {
  AccountMessageStatus,
  ConversationMessage,
  LoadMoreMessages,
  LoadSwarmUntil,
  Message,
  MESSAGES_NUMBER_TO_LOAD,
  ReactionAdded,
  ReactionRemoved,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import { MessageStatusCode } from '@savoirfairelinux/jami-web-common/src/enums/message-status-code'
import { createContext, memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import MessageList from '../components/MessageList.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationPreferencesStateContext } from '../contexts/ConversationPreferencesStateContext.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { useKeepConversationSummaryRead, useMessagesQuery } from '../services/conversationQueries.js'
import { getReadReceiptTarget } from '../utils/readReceipts.js'
import LoadingSkeleton from './common/LoadingSkeleton.js'
import ComposingMembersIndicator from './ComposingMembersIndicator.js'
import EditMessage from './EditMessage.js'
import FilePreviewsList from './FilePreviewsList.js'
import PendingConversationChat from './PendingConversationChat.js'
import ReplyToMessage from './ReplyToMessage.js'
import SendMessageForm from './SendMessageForm.js'
export const CurrentLastSeenMessageContext = createContext<Map<string, string>>(new Map())

interface ChatInterfaceManagerProps {
  openFilePicker: () => void
}

type State = {
  messagesMap: Map<string, Message>
  messageOrder: string[]
  replies: Map<string, string[]>
  lastSeen: Map<string, string>
  isLoading: boolean
  error: boolean
}

type Action =
  | { type: 'SET_MESSAGES'; messagesMap: Map<string, Message>; messageOrder: string[] }
  | { type: 'SET_REPLIES'; replies: Map<string, string[]> }
  | { type: 'SET_LAST_SEEN'; lastSeen: Map<string, string> }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: boolean }
  | { type: 'RESET' }

const initialState: State = {
  messagesMap: new Map(),
  messageOrder: [],
  replies: new Map(),
  lastSeen: new Map(),
  isLoading: true,
  error: false,
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messagesMap: action.messagesMap, messageOrder: action.messageOrder }
    case 'SET_REPLIES':
      return { ...state, replies: action.replies }
    case 'SET_LAST_SEEN':
      return { ...state, lastSeen: action.lastSeen }
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }
    case 'SET_ERROR':
      return { ...state, error: action.error }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

const ChatInterfaceManager = ({ openFilePicker }: ChatInterfaceManagerProps) => {
  const { conversationId, isPending } = useConversationContext()

  if (isPending) {
    return <PendingConversationChat openFilePicker={openFilePicker} />
  }

  return <ChatInterfaceManagerContent key={conversationId} openFilePicker={openFilePicker} />
}

const ChatInterfaceManagerContent = ({ openFilePicker }: ChatInterfaceManagerProps) => {
  const webSocket = useWebSocketContext()
  const { conversationId, members } = useConversationContext()
  const [state, dispatch] = useReducer(reducer, initialState)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const lastSentReadReceiptRef = useRef<string | undefined>(undefined)
  const { messagesMap, messageOrder, replies, lastSeen, isLoading, error } = state

  const messagesQuery = useMessagesQuery(conversationId, messagesMap.size === 0)
  const { account } = useAuthContext()

  const updateReplies = useCallback(
    (message: Message, replyToId: string) => {
      dispatch({
        type: 'SET_REPLIES',
        replies: new Map(replies.set(replyToId, [...(replies.get(replyToId) || []), message.id])),
      })
    },
    [replies],
  )

  useEffect(() => {
    if (messagesQuery.isLoading || messagesQuery.isError) {
      dispatch({ type: 'SET_LOADING', isLoading: true })
      return
    }

    if (messagesMap.size === 0 && messagesQuery.isSuccess && !isLoadingMore) {
      let isIncomplete = false
      const userView = new Set<string>()
      const newMessagesMap = new Map<string, Message>()
      let updatedMessageOrder: string[] = []

      messagesQuery.data.forEach((message) => {
        // convert to map
        message.status = new Map(Object.entries(message.status))

        for (const [peerId, status] of message.status) {
          if (peerId === account.getUri()) {
            continue
          }
          if (userView.size === members.length) {
            break
          }
          if (status === MessageStatusCode.read && !userView.has(peerId) && message.author === account.getUri()) {
            dispatch({
              type: 'SET_LAST_SEEN',
              lastSeen: new Map(lastSeen.set(peerId, message.id)),
            })
            userView.add(peerId)
          }
        }

        if (message['reply-to'] && typeof message['reply-to'] === 'string') {
          const replyToMessage = newMessagesMap.get(message['reply-to'])
          if (!replyToMessage) {
            const data = {
              accountId: account.id,
              conversationId: conversationId,
              fromMessageId: message.id,
              toMessageId: message['reply-to'],
              firstSection: true,
            }
            webSocket.send(WebSocketMessageType.LoadSwarmUntil, data)
            setIsLoadingMore(true)
            isIncomplete = true
          } else {
            message['reply-to'] = replyToMessage
            updateReplies(message, replyToMessage.id)
          }
        }
        updatedMessageOrder = addMessageId(updatedMessageOrder, message, newMessagesMap, true)
        newMessagesMap.set(message.id, { ...message })
      })

      if (!isIncomplete) {
        dispatch({
          type: 'SET_MESSAGES',
          messagesMap: newMessagesMap,
          messageOrder: updatedMessageOrder,
        })
        dispatch({ type: 'SET_LOADING', isLoading: false })
      }
    }
  }, [
    messagesQuery.isSuccess,
    messagesQuery.isLoading,
    messagesQuery.isError,
    messagesQuery.data,
    account,
    conversationId,
    members,
    updateReplies,
    webSocket,
    lastSeen,
    messagesMap.size,
    isLoadingMore,
  ])

  const messageStatusChangeHandler = useCallback(
    (data: AccountMessageStatus) => {
      const { messageId, status: messageStatus, peer } = data
      if (peer === account.getUri()) {
        return
      }

      const currentMessage = messagesMap.get(messageId)
      if (!currentMessage) {
        return
      }

      const currentStatus = currentMessage.status.get(peer) || 0
      const updatedStatus = new Map(currentMessage.status)
      if (messageStatus <= currentStatus) {
        return
      }

      updatedStatus.set(peer, messageStatus)

      const updatedMessage = {
        ...currentMessage,
        status: updatedStatus,
      }

      dispatch({
        type: 'SET_MESSAGES',
        messagesMap: new Map(messagesMap.set(messageId, updatedMessage)),
        messageOrder,
      })

      const isAccountMessage = currentMessage.author === account.getUri()

      if (messageStatus === MessageStatusCode.read && isAccountMessage) {
        dispatch({
          type: 'SET_LAST_SEEN',
          lastSeen: new Map(lastSeen.set(peer, messageId)),
        })
      }
    },
    [account, messagesMap, messageOrder, lastSeen],
  )

  const conversationMessageListener = useCallback(
    (data: ConversationMessage) => {
      if (conversationId !== data.conversationId) {
        return
      }
      const message = { ...data.message, animate: true }

      const newMessagesMap = new Map(messagesMap)
      const newMessage = { ...message }

      if (Object.keys(newMessage.status).length === 0) {
        const newStatus = new Map<string, MessageStatusCode>()
        members.forEach((member) => {
          newStatus.set(member.contact.uri, MessageStatusCode.sending)
        })
        newStatus.set(account.getUri(), MessageStatusCode.read)
        newMessage.status = newStatus
      } else if (!(newMessage.status instanceof Map)) {
        const statusMap = new Map<string, MessageStatusCode>()
        Object.entries(newMessage.status).forEach(([key, value]) => {
          if (typeof value === 'number' && Object.values(MessageStatusCode).includes(value)) {
            statusMap.set(key, value as MessageStatusCode)
          }
        })
        newMessage.status = statusMap
      }

      if (newMessage['reply-to'] && typeof newMessage['reply-to'] === 'string') {
        const replyToMessage = messagesMap.get(newMessage['reply-to'])
        if (replyToMessage) {
          newMessage['reply-to'] = replyToMessage
          setTimeout(() => updateReplies(newMessage, newMessage['reply-to'] as string), 0)
        }
      }

      newMessagesMap.set(newMessage.id, newMessage)

      dispatch({
        type: 'SET_MESSAGES',
        messagesMap: newMessagesMap,
        messageOrder: addMessageId(messageOrder, message, messagesMap, true),
      })
    },
    [account, conversationId, members, messagesMap, updateReplies, messageOrder],
  )

  const reactionsAddedListener = useCallback(
    (data: ReactionAdded) => {
      if (conversationId !== data.conversationId) {
        return
      }
      const message = messagesMap.get(data.messageId)
      if (message) {
        const updatedMessage = {
          ...message,
          reactions: message.reactions ? [...message.reactions, data.reaction] : [data.reaction],
        }

        dispatch({
          type: 'SET_MESSAGES',
          messagesMap: new Map(messagesMap.set(data.messageId, updatedMessage)),
          messageOrder,
        })
      }
    },
    [conversationId, messagesMap, messageOrder],
  )

  const reactionsRemovedListener = useCallback(
    (data: ReactionRemoved) => {
      if (conversationId !== data.conversationId) {
        return
      }
      const message = messagesMap.get(data.messageId)
      if (message) {
        const updatedReactions = message.reactions?.filter((reaction) => reaction.id !== data.reactionId)
        const updatedMessage = { ...message, reactions: updatedReactions }

        dispatch({
          type: 'SET_MESSAGES',
          messagesMap: new Map(messagesMap.set(data.messageId, updatedMessage)),
          messageOrder,
        })
      }
    },
    [conversationId, messagesMap, messageOrder],
  )

  const messageEditionListener = useCallback(
    (data: ConversationMessage) => {
      if (conversationId !== data.conversationId) {
        return
      }
      const message = messagesMap.get(data.message.id)
      if (message) {
        const updatedMessage = {
          ...message,
          body: data.message.body,
          editions: data.message.editions,
          fileId: data.message.fileId,
        }
        const newMessagesMap = new Map(messagesMap.set(data.message.id, updatedMessage))

        const repliesArray = replies.get(message.id)
        if (repliesArray) {
          repliesArray.forEach((replyId) => {
            const replyMessage = newMessagesMap.get(replyId)
            if (replyMessage) {
              const updatedReplyMessage = { ...replyMessage, 'reply-to': updatedMessage }
              newMessagesMap.set(replyId, updatedReplyMessage)
            }
          })
        }

        dispatch({
          type: 'SET_MESSAGES',
          messagesMap: newMessagesMap,
          messageOrder,
        })
      }
    },
    [replies, conversationId, messagesMap, messageOrder],
  )

  const loadMoreMessagesListener = useCallback(
    (data: LoadMoreMessages) => {
      if (conversationId !== data.conversationId) {
        return
      }
      setIsLoadingMore(true)
      const messages = data.messages
      if (messages === undefined) {
        return
      }
      const newMessagesMap = new Map(messagesMap)
      const newMessageOrder = [...messageOrder]

      for (const message of messages) {
        message.status = new Map(Object.entries(message.status))

        if (messagesMap.has(message.id)) {
          continue
        }
        if (!newMessagesMap.has(message.id)) {
          newMessageOrder.push(message.id)
          newMessagesMap.set(message.id, message)
        }
      }

      dispatch({
        type: 'SET_MESSAGES',
        messagesMap: newMessagesMap,
        messageOrder: newMessageOrder,
      })

      for (const message of messages) {
        if (message['reply-to'] && typeof message['reply-to'] === 'string') {
          const replyToMessage = newMessagesMap.get(message['reply-to'])
          if (!replyToMessage) {
            const data = {
              accountId: account.id,
              conversationId: conversationId,
              fromMessageId: message.id,
              toMessageId: message['reply-to'],
            }
            webSocket.send(WebSocketMessageType.LoadSwarmUntil, data)
          } else {
            message['reply-to'] = replyToMessage
            updateReplies(message, replyToMessage.id)
          }
        }
      }
      setIsLoadingMore(false)
    },
    [account, conversationId, messageOrder, messagesMap, updateReplies, webSocket],
  )

  const loadSwarmUntilListener = useCallback(
    (data: LoadSwarmUntil) => {
      if (conversationId !== data.conversationId) {
        return
      }
      const messages = data.messages
      if (messages === undefined) {
        return
      }
      const newMessagesMap = new Map(messagesMap)
      const newMessageOrder = [...messageOrder]

      for (const message of messages) {
        message.status = new Map(Object.entries(message.status))

        if (messagesMap.has(message.id)) {
          continue
        }
        if (!newMessagesMap.has(message.id)) {
          newMessagesMap.set(message.id, message)
          newMessageOrder.push(message.id)
        }
      }

      dispatch({
        type: 'SET_MESSAGES',
        messagesMap: newMessagesMap,
        messageOrder: newMessageOrder,
      })

      for (const message of messages) {
        if (message['reply-to'] && typeof message['reply-to'] === 'string') {
          const replyToMessage = newMessagesMap.get(message['reply-to'])
          if (replyToMessage) {
            message['reply-to'] = replyToMessage
            updateReplies(message, replyToMessage.id)
          }
        }
      }

      if (
        data.firstSection &&
        data.messages &&
        data.messages.length !== 0 &&
        data.messages.length < MESSAGES_NUMBER_TO_LOAD
      ) {
        const limit = MESSAGES_NUMBER_TO_LOAD - data.messages.length
        const last = data.messages[data.messages.length - 1].id
        const args = {
          accountId: account.id,
          conversationId: conversationId,
          lastMessageId: last,
          limit: limit,
        }
        webSocket.send(WebSocketMessageType.LoadMoreMessages, args)
      }

      dispatch({ type: 'SET_LOADING', isLoading: false })
    },
    [account, conversationId, messageOrder, messagesMap, updateReplies, webSocket],
  )

  const bindWebSocketEvents = useCallback(() => {
    webSocket.bind(WebSocketMessageType.LoadSwarmUntil, loadSwarmUntilListener)
    webSocket.bind(WebSocketMessageType.LoadMoreMessages, loadMoreMessagesListener)
    webSocket.bind(WebSocketMessageType.AccountMessageStatus, messageStatusChangeHandler)
    webSocket.bind(WebSocketMessageType.ConversationMessage, conversationMessageListener)
    webSocket.bind(WebSocketMessageType.MessageEdition, messageEditionListener)
    webSocket.bind(WebSocketMessageType.ReactionAdded, reactionsAddedListener)
    webSocket.bind(WebSocketMessageType.ReactionRemoved, reactionsRemovedListener)
  }, [
    webSocket,
    loadSwarmUntilListener,
    loadMoreMessagesListener,
    messageStatusChangeHandler,
    conversationMessageListener,
    messageEditionListener,
    reactionsAddedListener,
    reactionsRemovedListener,
  ])

  const unbindWebSocketEvents = useCallback(() => {
    webSocket.unbind(WebSocketMessageType.LoadSwarmUntil, loadSwarmUntilListener)
    webSocket.unbind(WebSocketMessageType.LoadMoreMessages, loadMoreMessagesListener)
    webSocket.unbind(WebSocketMessageType.AccountMessageStatus, messageStatusChangeHandler)
    webSocket.unbind(WebSocketMessageType.ConversationMessage, conversationMessageListener)
    webSocket.unbind(WebSocketMessageType.MessageEdition, messageEditionListener)
    webSocket.unbind(WebSocketMessageType.ReactionAdded, reactionsAddedListener)
    webSocket.unbind(WebSocketMessageType.ReactionRemoved, reactionsRemovedListener)
  }, [
    webSocket,
    loadSwarmUntilListener,
    loadMoreMessagesListener,
    messageStatusChangeHandler,
    conversationMessageListener,
    messageEditionListener,
    reactionsAddedListener,
    reactionsRemovedListener,
  ])

  useEffect(() => {
    bindWebSocketEvents()
    return () => {
      unbindWebSocketEvents()
    }
  }, [bindWebSocketEvents, unbindWebSocketEvents])

  const messagesArray = useMemo(() => {
    return messageOrder.map((id) => messagesMap.get(id)).filter(Boolean) as Message[]
  }, [messageOrder, messagesMap])
  useKeepConversationSummaryRead(conversationId, messagesArray[0]?.id)

  const { searchQuery } = useConversationPreferencesStateContext()

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return messagesArray
    const q = searchQuery.toLowerCase()
    return messagesArray.filter((msg) => msg.body?.toLowerCase().includes(q))
  }, [messagesArray, searchQuery])

  useEffect(() => {
    if (messagesArray.length === 0) {
      return
    }

    const accountUri = account.getUri()
    const messageId = getReadReceiptTarget(messagesArray, accountUri)
    if (!messageId || lastSentReadReceiptRef.current === messageId) {
      return
    }

    lastSentReadReceiptRef.current = messageId
    webSocket.send(WebSocketMessageType.AccountMessageStatus, {
      messageId,
      peer: accountUri,
      conversationId,
      status: MessageStatusCode.read,
    })
  }, [messagesArray, account, conversationId, webSocket])

  if (isLoading) {
    return <LoadingSkeleton />
  } else if (error) {
    return <div>Error loading {conversationId}</div>
  }

  return (
    <>
      <CurrentLastSeenMessageContext value={lastSeen}>
        <MessageList messages={filteredMessages} />
      </CurrentLastSeenMessageContext>
      <ComposingMembersIndicator />
      <FilePreviewsList />
      <ReplyToMessage />
      <EditMessage />

      <SendMessageForm openFilePicker={openFilePicker} />
    </>
  )
}

const addMessageId = (
  messageOrder: string[],
  message: Message,
  messagesMap: Map<string, Message>,
  invert = false,
): string[] => {
  if (messageOrder.length === 0) {
    return [message.id]
  }
  if (!message) return messageOrder

  if (messageOrder.includes(message.id)) {
    return messageOrder
  }

  const lastMessage = messagesMap.get(messageOrder[messageOrder.length - 1])
  const firstMessage = messagesMap.get(messageOrder[0])

  if ((firstMessage && message.id === firstMessage.id) || (lastMessage && message.id === lastMessage.id)) {
    return messageOrder
  }

  if (firstMessage && message.linearizedParent === firstMessage.id) {
    if (invert) return [message.id, ...messageOrder]
    return [...messageOrder, message.id]
  }

  if (lastMessage && message.id === lastMessage.linearizedParent) {
    if (invert) return [...messageOrder, message.id]
    return [message.id, ...messageOrder]
  }

  return [message.id, ...messageOrder]
}

export default memo(ChatInterfaceManager)
