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

import { Box, CircularProgress, Grid, IconButtonProps, Stack, Typography } from '@mui/material'
import { ComponentType, ReactNode, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import {
  CallingAnswerAudioButton,
  CallingAnswerVideoButton,
  CallingCancelButton,
  CallingRefuseButton,
} from '../components/CallButtons.js'
import ConversationAvatar from '../components/ConversationAvatar.js'
import { useCallManagerContext } from '../contexts/CallManagerProvider.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useUserMediaContext } from '../contexts/UserMediaProvider.js'
import { CallStatus } from '../services/CallManager.js'
import { VideoElementWithSinkId } from '../utils/utils.js'

export const CallPending = () => {
  const { conversationDisplayName } = useConversationContext()
  const { localStream } = useUserMediaContext()
  const { callData } = useCallManagerContext()
  const localVideoRef = useRef<VideoElementWithSinkId | null>(null)

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, localVideoRef])

  return (
    <Stack
      direction="column"
      spacing={4}
      sx={{
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        flexGrow: 1,
        position: 'relative',
      }}
    >
      <video
        ref={localVideoRef}
        autoPlay
        muted
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          objectFit: 'cover',
          backgroundColor: 'black',
          zIndex: -1,
        }}
      />
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '30%',
        }}
      >
        <Box
          sx={{
            aspectRatio: '1',
            height: '100%',
            position: 'absolute',
          }}
        >
          <CircularProgress
            disableShrink
            thickness={1}
            size="100%"
            sx={{
              position: 'absolute',
              color: 'white',
              zIndex: 1,
            }}
          />
          <ConversationAvatar
            contactUri=""
            alt="contact profile picture"
            displayName={conversationDisplayName}
            style={{
              width: '100%',
              height: '100%',
            }}
          />
        </Box>
      </Box>
      {callData?.role === 'caller' ? <CallPendingCallerInterface /> : <CallPendingReceiverInterface />}
    </Stack>
  )
}

const CallPendingDetails = ({
  title,
  buttons,
}: {
  title: ReactNode
  buttons: {
    ButtonComponent: ComponentType<IconButtonProps>
    title: ReactNode
  }[]
}) => {
  return (
    <>
      <Typography variant="h1" color="white">
        {title}
      </Typography>
      <Box
        sx={{
          width: '50%',
        }}
      >
        <Grid
          container
          sx={{
            justifyContent: 'center',
          }}
        >
          {buttons.map(({ ButtonComponent, title: buttonTitle }) => (
            <Grid key={ButtonComponent.displayName ?? ButtonComponent.name} size={4}>
              <Stack
                direction="column"
                spacing={1}
                sx={{
                  alignItems: 'center',
                }}
              >
                <ButtonComponent color="inherit" size="large" />
                <Typography variant="body2" color="white" sx={{ opacity: 0.75 }}>
                  {buttonTitle}
                </Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>
      </Box>
    </>
  )
}

export const CallPendingCallerInterface = () => {
  const { callStatus } = useCallManagerContext()
  const { t } = useTranslation()
  const { members } = useConversationContext()
  const memberName = useMemo(() => members[0].getDisplayName(), [members])

  let title = t('loading')

  switch (callStatus) {
    case CallStatus.Ringing:
      title = t('calling', {
        member0: memberName,
      })
      break
    case CallStatus.Connecting:
      title = t('connecting')
      break
  }

  return (
    <CallPendingDetails
      title={title}
      buttons={[
        {
          ButtonComponent: CallingCancelButton,
          title: t('end_call'),
        },
      ]}
    />
  )
}

export const CallPendingReceiverInterface = () => {
  const { state } = useLocation()
  const { callStatus } = useCallManagerContext()

  const { t } = useTranslation()
  const { members } = useConversationContext()
  const memberName = useMemo(() => members[0].getDisplayName(), [members])

  let title = t('loading')

  switch (callStatus) {
    case CallStatus.Ringing:
    case CallStatus.Default:
      title = t('incoming_call', {
        context: state?.isVideoOn ? 'video' : 'audio',
        member0: memberName,
      })
      break
    case CallStatus.Connecting:
      title = t('connecting')
      break
  }

  return (
    <CallPendingDetails
      title={title}
      buttons={[
        {
          ButtonComponent: CallingRefuseButton,
          title: t('decline_call'),
        },
        {
          ButtonComponent: CallingAnswerAudioButton,
          title: t('accept_call_audio'),
        },
        {
          ButtonComponent: CallingAnswerVideoButton,
          title: t('accept_call_video'),
        },
      ]}
    />
  )
}
