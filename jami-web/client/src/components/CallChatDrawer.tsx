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
import { Divider, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useCallManagerContext } from '../contexts/CallManagerProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import ChatInterface from '../pages/ChatInterface.js'
import BaseIconButton from './common/BaseIconButton.js'
import { SaltireIcon } from './SvgIcon.js'

export default () => {
  return (
    <Stack
      sx={{
        width: '33%',
        height: '100%',
        backgroundColor: 'white',
      }}
    >
      <CallChatDrawerHeader />
      <Divider
        sx={{
          borderTop: '1px solid #E5E5E5',
        }}
      />
      <ChatInterface />
    </Stack>
  )
}

const CallChatDrawerHeader = () => {
  const { t } = useTranslation()
  const { setIsChatShown } = useCallManagerContext()
  const { conversationDisplayName } = useConversationContext()

  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        padding: 2,
        alignItems: 'center',
      }}
    >
      <BaseIconButton
        aria-label={t('call_close_chat')}
        tooltip={t('call_close_chat')}
        sx={{ color: 'primary.main', fontSize: '15px', height: '30px', width: '30px' }}
        onClick={() => {
          setIsChatShown(false)
        }}
      >
        <SaltireIcon fontSize="inherit" />
      </BaseIconButton>
      <Stack direction="column">
        <Typography
          variant="h3"
          sx={{
            textOverflow: 'ellipsis',
          }}
        >
          {conversationDisplayName}
        </Typography>
      </Stack>
    </Stack>
  )
}
