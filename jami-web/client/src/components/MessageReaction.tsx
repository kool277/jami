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
import { Message, ReactionRemoved, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { motion } from 'framer-motion'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import BaseButton from './common/BaseButton.js'
import BaseModalDialog from './common/BaseModalDialog.js'
import EllipsisMiddle from './EllipsisMiddle.js'

export interface MessageReactionProps {
  message: Message
  position: 'start' | 'end'
}

const messageCornerRadius = '20px'

const MessageReaction = ({ message, position }: MessageReactionProps) => {
  interface ReactionAttributes {
    body: string
    id: string
    amount: number
  }
  const webSocket = useWebSocketContext()
  const { t } = useTranslation()
  const { conversationId } = useConversationContext()
  const [isOpen, setIsOpen] = useState(false)
  const { members } = useConversationContext()
  const { account } = useAuthContext()
  const membersMap = useMemo(() => new Map(members.map((member) => [member.contact.uri, member])), [members])
  const reactionsArray = useMemo(() => {
    const reactionAttributesArray: Array<ReactionAttributes> = []

    for (const reaction of message.reactions) {
      if (reaction.id !== undefined) {
        const index = reactionAttributesArray.findIndex((element) => element.body === reaction.body)
        if (index === -1) {
          reactionAttributesArray.push({ body: reaction.body, id: reaction.id, amount: 1 })
        } else {
          if (reactionAttributesArray[index].amount !== undefined) {
            reactionAttributesArray[index].amount += 1
          }
        }
      }
    }

    return reactionAttributesArray
  }, [message.reactions])

  const container = {
    hidden: { opacity: 1, scale: 1.25 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        delayChildren: 0.4,
        staggerChildren: 0.2,
      },
    },
  }
  const item = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  }

  function handleCloseModal() {
    setIsOpen(false)
  }

  const handleDeleteReaction = (reactionId: string) => {
    const data: ReactionRemoved = {
      conversationId: conversationId,
      messageId: message.id,
      reactionId: reactionId,
    }

    webSocket.send(WebSocketMessageType.ReactionRemoved, data)
  }

  const sortedReactionsArray = useMemo(() => {
    return [...reactionsArray].sort((a, b) => (b.amount || 0) - (a.amount || 0))
  }, [reactionsArray])

  if (reactionsArray.length === 0) {
    return null
  }

  return (
    <>
      <Box
        data-cy="emoji-reaction-list"
        onClick={() => setIsOpen(!isOpen)}
        sx={{
          position: 'absolute',
          bottom: 0,
          ...(position === 'start' ? { left: messageCornerRadius } : { right: messageCornerRadius }),
          cursor: 'pointer',
        }}
      >
        <motion.div
          initial={message.animate ? 'hidden' : undefined}
          animate={message.animate ? 'visible' : undefined}
          variants={message.animate ? container : undefined}
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '15px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '2px 6px',
            boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.24)',
          }}
        >
          {sortedReactionsArray.slice(0, 3).map((reaction: ReactionAttributes) => (
            <motion.span variants={message.animate ? item : undefined} key={reaction.id}>
              {reaction.body}
            </motion.span>
          ))}
        </motion.div>
      </Box>

      <BaseModalDialog
        open={isOpen && reactionsArray.length > 0}
        selectedValue=""
        title={t('message_reactions')}
        onClose={handleCloseModal}
        closePolicy={['escapeKeyDown', 'backdropClick']}
        dialogWidth={350}
        contentSx={{ maxHeight: '40vh' }}
        actions={
          <BaseButton variant="text" onClick={handleCloseModal}>
            {t('dialog_close')}
          </BaseButton>
        }
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {message.reactions.map((reaction) => {
            const author = membersMap.get(reaction.author)?.contact.uri
            return (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: 2,
                  width: '100%',
                  textAlign: 'center',
                }}
                key={reaction.id}
              >
                {author === account.getUri() ? (
                  <>
                    <Box>{t('yourself')}</Box>
                    <BaseButton
                      aria-label={t('message_reaction_remove', { reaction: reaction.body })}
                      variant="text"
                      onClick={() => reaction.id && handleDeleteReaction(reaction.id)}
                    >
                      {reaction.body}
                    </BaseButton>
                  </>
                ) : (
                  <>
                    <Box sx={{ maxWidth: '200px' }}>
                      <EllipsisMiddle text={author || t('unknown')} />
                    </Box>
                    <Box>{reaction.body}</Box>
                  </>
                )}
              </Box>
            )
          })}
        </Box>
      </BaseModalDialog>
    </>
  )
}

export default memo(MessageReaction)
