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

import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import { useActionMessageReadContext } from '../contexts/ActionMessageProvider.js'
import { useGlobalSetReplyMessage } from '../contexts/ActionMessageProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import BaseIconButton from './common/BaseIconButton.js'
import MessageDataContent from './MessageDataContent.js'
import { Arrow4Icon as ReplyIcon, CancelIcon } from './SvgIcon.js'

export default function ReplyToMessage() {
  const { members } = useConversationContext()
  const { t } = useTranslation()
  const { account } = useAuthContext()
  const { replyMessage: message } = useActionMessageReadContext()
  const setMessage = useGlobalSetReplyMessage()
  const theme = useTheme()
  const isReduced: boolean = useMediaQuery(theme.breakpoints.down('sm'))

  if (message === undefined) {
    return
  }

  function cancelHandler() {
    setMessage(undefined)
  }

  function getName() {
    if (message === undefined) {
      return
    }
    if (account.getUri() === message.author) {
      return t('yourself')
    } else {
      const member = members.find((member) => message.author === member.contact.uri)
      return member?.contact.getDisplayName()
    }
  }
  const content = message.body === '' ? t('message_deleted') : message.body

  return (
    <>
      <motion.div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '5px',
        }}
      >
        <Box
          sx={{
            maxWidth: isReduced ? '350px' : '100%',
            color: 'black',
            width: '96%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            alignContent: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              alignContent: 'center',
              width: '100%',
            }}
          >
            <Box sx={{ paddingLeft: '5px', marginTop: '25px' }}>
              <ReplyIcon />
            </Box>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                marginLeft: '3%',
                width: '100%',
              }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('replying_to') + ' ' + getName()}
              </Typography>
              <div
                style={{ backgroundColor: theme.palette.background.paper, borderRadius: '12px', overflow: 'hidden' }}
              >
                <Box
                  sx={{
                    padding: '5px',
                    color: '#606060',
                    fontStyle: 'italic',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {message.type === 'text/plain' ? (
                    <Box>{content}</Box>
                  ) : message.type === 'application/data-transfer+json' ? (
                    <Box sx={{ paddingBottom: '0.5rem' }}>
                      <MessageDataContent
                        isReply={true}
                        displayName={message.displayName || 'Unknown'}
                        totalSize={Number(message.totalSize)}
                      />
                    </Box>
                  ) : (
                    <Box>Error loading message</Box>
                  )}
                </Box>
              </div>
            </Box>
            <BaseIconButton
              aria-label={t('cancel_reply')}
              tooltip={t('cancel_reply')}
              sx={{ marginLeft: '5px', marginTop: '20px' }}
              onClick={cancelHandler}
            >
              <CancelIcon />
            </BaseIconButton>
          </Box>
        </Box>
      </motion.div>
    </>
  )
}
