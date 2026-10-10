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
import { ConversationInfos, WebSocketMessageTable, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { useUserMediaContext } from '../contexts/UserMediaProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { ConversationMember } from '../models/conversation-member.js'
import { useConversationInfosQuery, useMembersQuery } from '../services/conversationQueries.js'
import { callTimeoutMs } from '../utils/constants.js'
import { AsyncSetState, SetState } from '../utils/utils.js'
import { useWebRtcManager } from '../webrtc/WebRtcManager.js'

export type CallRole = 'caller' | 'receiver' | undefined

export type CallData = {
  conversationId: string
  role: CallRole
  withVideoOn?: boolean
}

export enum CallStatus {
  Default,
  Loading,
  Ringing,
  Connecting,
  InCall,
  PermissionsDenied,
}

export enum VideoStatus {
  Off,
  Camera,
  ScreenShare,
}

export interface ICallManager {
  callData: CallData | undefined
  callConversationInfos: ConversationInfos | undefined
  callMembers: ConversationMember[] | undefined

  remoteStreams: readonly MediaStream[]

  isAudioOn: boolean
  setIsAudioOn: SetState<boolean>
  videoStatus: VideoStatus
  updateVideoStatus: AsyncSetState<VideoStatus>
  isChatShown: boolean
  setIsChatShown: SetState<boolean>
  isFullscreen: boolean
  setIsFullscreen: SetState<boolean>
  callStatus: CallStatus
  callStartTime: number | undefined

  startCall: (conversationId: string, withVideoOn?: boolean) => void
  acceptCall: (withVideoOn: boolean) => void
  endCall: () => void
}

export const useCallManager = () => {
  const { setAlertContent } = use(AlertSnackbarContext)
  const [callData, setCallData] = useState<CallData>()
  const webSocket = useWebSocketContext()
  const navigate = useNavigate()
  const { data: callConversationInfos } = useConversationInfosQuery(callData?.conversationId)
  const { data: callMembers } = useMembersQuery(callData?.conversationId)

  const {
    localStream,
    updateLocalStream,
    screenShareLocalStream,
    updateScreenShare,
    setAudioInputDeviceId,
    setVideoDeviceId,
    stopMedias,
  } = useUserMediaContext()
  const { account } = useAuthContext()
  const webRtcManager = useWebRtcManager()

  const [isAudioOn, setIsAudioOn] = useState(false)
  const [videoStatus, setVideoStatus] = useState(VideoStatus.Off)
  const [isChatShown, setIsChatShown] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [callStatus, setCallStatus] = useState(CallStatus.Default)
  const [callStartTime, setCallStartTime] = useState<number | undefined>(undefined)

  useEffect(() => {
    const callInviteListener = ({ conversationId, withVideoOn }: WebSocketMessageTable['onCallInvite']) => {
      if (callData) {
        // TODO: Currently, we display a notification if already in a call.
        //       In the future, we should handle receiving a call while already in another.
        setAlertContent({
          messageI18nKey: 'missed_incoming_call',
          messageI18nContext: { conversationId },
          severity: 'info',
          alertOpen: true,
        })
        return
      }

      setCallData({ conversationId: conversationId, role: 'receiver', withVideoOn })
      navigate(`/conversation/${conversationId}`)
    }

    webSocket.bind(WebSocketMessageType.onCallInvite, callInviteListener)

    return () => {
      webSocket.unbind(WebSocketMessageType.onCallInvite, callInviteListener)
    }
  }, [webSocket, navigate, callData, setAlertContent])

  const conversationId = callData?.conversationId
  const contactUri = callMembers?.[0]?.contact.uri
  const connectionInfos = contactUri ? webRtcManager.connectionsInfos[contactUri] : undefined
  const remoteStreams = useMemo(() => connectionInfos?.remoteStreams || [], [connectionInfos])
  const iceConnectionState = connectionInfos?.iceConnectionState

  // TODO: Transform the effect into a callback
  const updateLocalStreams = webRtcManager.updateLocalStreams
  useEffect(() => {
    if ((!localStream && !screenShareLocalStream) || !updateLocalStreams) {
      return
    }

    updateLocalStreams(localStream, screenShareLocalStream)
  }, [localStream, screenShareLocalStream, updateLocalStreams])

  const closeConnection = useCallback(() => {
    stopMedias()
    webRtcManager.clean()
  }, [stopMedias, webRtcManager])

  // Tracks logic should be moved into UserMediaProvider
  useEffect(() => {
    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        track.enabled = isAudioOn
        const deviceId = track.getSettings().deviceId
        if (deviceId) {
          setAudioInputDeviceId(deviceId)
        }
      }
    }
  }, [isAudioOn, localStream, setAudioInputDeviceId])

  // Tracks logic should be moved into UserMediaProvider
  useEffect(() => {
    if (localStream) {
      for (const track of localStream.getVideoTracks()) {
        track.enabled = videoStatus === VideoStatus.Camera
        const deviceId = track.getSettings().deviceId
        if (deviceId) {
          setVideoDeviceId(deviceId)
        }
      }
    }
  }, [videoStatus, localStream, setVideoDeviceId])

  // Track logic should be moved into UserMediaProvider
  const updateVideoStatus = useCallback(
    async (newStatus: ((prevState: VideoStatus) => VideoStatus) | VideoStatus) => {
      if (typeof newStatus === 'function') {
        newStatus = newStatus(videoStatus)
      }

      const stream = await updateScreenShare(newStatus === VideoStatus.ScreenShare)
      if (stream) {
        for (const track of stream.getTracks()) {
          track.addEventListener('ended', () => {
            console.warn('Browser ended screen sharing')
            setVideoStatus(VideoStatus.Off)
          })
        }
      }

      setVideoStatus(newStatus)
    },
    [videoStatus, updateScreenShare],
  )

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement !== null)
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
    }
  }, [])

  const startCall = useCallback(
    (conversationId: string, withVideoOn = false) => {
      setCallData({ conversationId, withVideoOn, role: 'caller' })
      if (callStatus === CallStatus.Default) {
        setCallStatus(CallStatus.Loading)
        updateLocalStream()
          .then(() => {
            const callInvite: WebSocketMessageTable['sendCallInvite'] = {
              conversationId: conversationId,
              withVideoOn,
            }

            setCallStatus(CallStatus.Ringing)
            setVideoStatus(withVideoOn ? VideoStatus.Camera : VideoStatus.Off)
            webSocket.send(WebSocketMessageType.sendCallInvite, callInvite)
          })
          .catch((e) => {
            console.error(e)
            setCallStatus(CallStatus.PermissionsDenied)
          })
      }
    },
    [webSocket, updateLocalStream, callStatus],
  )

  const acceptCall = useCallback(
    (withVideoOn: boolean) => {
      if (!callMembers || !conversationId) {
        console.warn('acceptCall without callMembers or conversationId')
        return
      }
      setCallStatus(CallStatus.Loading)
      updateLocalStream()
        .then(() => {
          const callAccept: WebSocketMessageTable['sendCallJoin'] = {
            conversationId,
          }

          setVideoStatus(withVideoOn ? VideoStatus.Camera : VideoStatus.Off)
          setCallStatus(CallStatus.Connecting)
          console.info('Sending CallJoin', callAccept)
          webSocket.send(WebSocketMessageType.sendCallJoin, callAccept)
          // TODO: move this to "onWebRtcDescription" listener so we don't add connections for non-connected members
          callMembers.forEach((member) =>
            webRtcManager.addConnection(
              webSocket,
              account,
              member.contact.uri,
              callData,
              localStream,
              screenShareLocalStream,
            ),
          )
        })
        .catch((e) => {
          console.error(e)
          setCallStatus(CallStatus.PermissionsDenied)
        })
    },
    [
      account,
      callData,
      conversationId,
      localStream,
      callMembers,
      screenShareLocalStream,
      updateLocalStream,
      webRtcManager,
      webSocket,
    ],
  )

  useEffect(() => {
    if (callData?.role === 'caller' && callStatus === CallStatus.Ringing) {
      const callJoinListener = (data: WebSocketMessageTable['onCallJoin']) => {
        console.info('Received event on CallJoin', data, callData)
        if (data.conversationId !== conversationId) {
          console.warn('Wrong incoming conversationId, ignoring action')
          return
        }

        setCallStatus(CallStatus.Connecting)

        webRtcManager.addConnection(webSocket, account, data.senderId, callData, localStream, screenShareLocalStream)
      }

      webSocket.bind(WebSocketMessageType.onCallJoin, callJoinListener)

      return () => {
        webSocket.unbind(WebSocketMessageType.onCallJoin, callJoinListener)
      }
    }
  }, [account, callData, callStatus, conversationId, localStream, screenShareLocalStream, webRtcManager, webSocket])

  const endCall = useCallback(() => {
    if (!conversationId) {
      return
    }

    const callExit: WebSocketMessageTable['sendCallExit'] = {
      conversationId,
    }

    console.info('Sending CallExit', callExit)
    closeConnection()
    webSocket.send(WebSocketMessageType.sendCallExit, callExit)
    setCallData(undefined)
    setCallStatus(CallStatus.Default)
    // TODO: write in chat that the call ended
  }, [webSocket, conversationId, closeConnection])

  useEffect(() => {
    const callExitListener = (data: WebSocketMessageTable['onCallExit']) => {
      console.info('Received event on CallExit', data)
      if (data.conversationId !== conversationId) {
        console.warn('Wrong incoming conversationId, ignoring action')
        return
      }

      endCall()
      // TODO: write in chat that the call ended
    }

    webSocket.bind(WebSocketMessageType.onCallExit, callExitListener)
    return () => {
      webSocket.unbind(WebSocketMessageType.onCallExit, callExitListener)
    }
  }, [webSocket, endCall, conversationId])

  useEffect(() => {
    if (
      callStatus === CallStatus.Connecting &&
      (iceConnectionState === 'connected' || iceConnectionState === 'completed')
    ) {
      console.info('Changing call status to InCall')
      void Promise.resolve().then(() => {
        setCallStatus(CallStatus.InCall)
        setCallStartTime(Date.now())
      })
    }
  }, [iceConnectionState, callStatus])

  useEffect(() => {
    if (iceConnectionState === 'disconnected' || iceConnectionState === 'failed') {
      console.info('ICE connection disconnected or failed, ending call')
      void Promise.resolve().then(endCall)
    }
  }, [iceConnectionState, callStatus, videoStatus, endCall])

  useEffect(() => {
    const checkStatusTimeout = () => {
      if (callStatus !== CallStatus.InCall) {
        endCall()
      }
    }
    const timeoutId = setTimeout(checkStatusTimeout, callTimeoutMs)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [callStatus, endCall])

  return useMemo(
    () => ({
      callData,
      callConversationInfos,
      callMembers,
      remoteStreams,
      isAudioOn,
      setIsAudioOn,
      videoStatus,
      updateVideoStatus,
      isChatShown,
      setIsChatShown,
      isFullscreen,
      setIsFullscreen,
      callStatus,
      callStartTime,
      startCall,
      acceptCall,
      endCall,
    }),
    [
      callData,
      callConversationInfos,
      callMembers,
      remoteStreams,
      isAudioOn,
      videoStatus,
      setIsAudioOn,
      updateVideoStatus,
      isChatShown,
      setIsChatShown,
      isFullscreen,
      setIsFullscreen,
      callStatus,
      callStartTime,
      startCall,
      acceptCall,
      endCall,
    ],
  )
}
