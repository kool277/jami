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
import { Box, Card, CardContent, Divider, IconButton, TextareaAutosize, Tooltip, useTheme } from '@mui/material'
import { Stack, useMediaQuery } from '@mui/system'
import { WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { t } from 'i18next'
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useActionMessageReadContext, useActionMessageWriteContext } from '../contexts/ActionMessageProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationPreferencesColorContext } from '../contexts/ConversationPreferencesColorContext.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { ConversationMember } from '../models/conversation-member.js'
import { useEditMessageMutation, useSendMessageMutation } from '../services/conversationQueries.js'
import { useSendFilesMutation } from '../services/dataTransferQueries.js'
import { useStartConversationMutation } from '../services/pendingConversationQueries.js'
import { translateEnumeration, TranslateEnumerationOptions } from '../utils/translations.js'
import BaseIconButton from './common/BaseIconButton.js'
import SelectEmojiButton from './SelectEmojiButton.js'
import { DeleteIcon } from './SvgIcon.js'
import {
  Arrow2Icon,
  CameraInBubbleIcon,
  FormatBoldIcon,
  FormatCodeIcon,
  FormatItalicIcon,
  FormatListBulletedIcon,
  FormatListNumberedIcon,
  FormatQuoteIcon,
  FormatStrikethroughIcon,
  FormatTitleIcon,
  LinkIcon,
  MicroInBubbleIcon,
  PaperClipIcon,
} from './SvgIcon.js'

interface SendMessageFormProps {
  openFilePicker: () => void
}

export default function SendMessageForm({ openFilePicker }: SendMessageFormProps) {
  const { editMessage } = useActionMessageReadContext()

  return <SendMessageFormContent key={editMessage?.id ?? 'new-message'} openFilePicker={openFilePicker} />
}

const SendMessageFormContent = ({ openFilePicker }: SendMessageFormProps) => {
  const webSocket = useWebSocketContext()
  const { members, conversationId, isPending, pendingContact } = useConversationContext()
  const navigate = useNavigate()
  const { editMessage, replyMessage: selectedReply, fileHandlers } = useActionMessageReadContext()
  const [currentMessage, setCurrentMessage] = useState<string>(editMessage?.body || '')
  const composingNotificationTimeRef = useRef(0)
  const placeholder = usePlaceholder(members)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [firstTime, setFirstTime] = useState(-1)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const waveformDataRef = useRef<Array<{ data: Uint8Array; progress: number }>>([])
  const frameCountRef = useRef<number>(0)
  const scrollOffsetRef = useRef<number>(0)
  const { conversationColor } = useConversationPreferencesColorContext()
  const {
    setEditMessage: setIsEditing,
    setReplyMessage: setSelectedReply,
    setFileHandlers,
  } = useActionMessageWriteContext()

  const sendMessageMutation = useSendMessageMutation(conversationId)
  const editMessageMutation = useEditMessageMutation(conversationId)
  const sendFilesMutation = useSendFilesMutation(conversationId)
  const startConversationMutation = useStartConversationMutation()

  const theme = useTheme()
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const isMedium: boolean = useMediaQuery(theme.breakpoints.only('sm'))
  const isMoreThanMedium: boolean = useMediaQuery(theme.breakpoints.up('md'))
  const isReduced = isMobile || isMedium

  const sendMessage = useCallback(
    (message: string) => {
      if (message !== 'files-to-send') {
        sendMessageMutation.mutate({ body: message, replyTo: selectedReply?.id })
      }

      const data: FormData = new FormData()
      for (const file of fileHandlers) {
        data.append('file', file.file)
      }

      data.append('replyTo', selectedReply?.id || '')
      sendFilesMutation.mutate(data)
      setFileHandlers([])
    },
    [fileHandlers, selectedReply?.id, sendFilesMutation, sendMessageMutation, setFileHandlers],
  )

  const editMessageHandler = useCallback(
    (message: string) => {
      editMessageMutation.mutate({ body: message, messageId: editMessage!.id })
    },
    [editMessage, editMessageMutation],
  )

  // The first message of a pending conversation doubles as the invitation: the
  // swarm only comes into existence once the peer has been added as a contact.
  const startPendingConversation = useCallback(
    (body: string | undefined, files: File[]) => {
      if (!pendingContact) {
        return
      }

      let data: FormData | undefined
      if (files.length > 0) {
        data = new FormData()
        for (const file of files) {
          data.append('file', file)
        }
      }

      startConversationMutation.mutate(
        { contactUri: pendingContact.uri, body, files: data },
        { onSuccess: (conversationId) => navigate(`/conversation/${conversationId}`, { replace: true }) },
      )
      setFileHandlers([])
    },
    [navigate, pendingContact, setFileHandlers, startConversationMutation],
  )

  const handleSendMessage = useCallback(
    (message: string, audioFile?: File) => {
      if (isPending) {
        if (message === 'audio-message') {
          startPendingConversation(undefined, audioFile ? [audioFile] : [])
        } else {
          startPendingConversation(
            message === 'files-to-send' ? undefined : message,
            fileHandlers.map((fileHandler) => fileHandler.file),
          )
        }
        return
      }

      if (message === 'audio-message') {
        if (audioFile) {
          const data: FormData = new FormData()
          data.append('file', audioFile)
          data.append('replyTo', selectedReply?.id || '')
          sendFilesMutation.mutate(data)
        }
        setSelectedReply(undefined)
        return
      }
      if (editMessage) {
        editMessageHandler(message)
        setSelectedReply(undefined)
        return
      }
      sendMessage(message)
      setSelectedReply(undefined)
      setIsEditing(undefined)
      setFileHandlers([])
    },
    [
      editMessage,
      editMessageHandler,
      fileHandlers,
      isPending,
      selectedReply?.id,
      sendFilesMutation,
      sendMessage,
      setFileHandlers,
      setIsEditing,
      setSelectedReply,
      startPendingConversation,
    ],
  )

  const notifyComposing = useCallback(() => {
    if (isPending) {
      return
    }

    const currentTime = new Date().getTime()
    // The daemon automatically turns off "isComposing" after 12 seconds
    // We ensure it will stay on at least 4 seconds after the last typed character
    if (currentTime - composingNotificationTimeRef.current > 8000) {
      composingNotificationTimeRef.current = currentTime
      webSocket.send(WebSocketMessageType.ComposingStatus, { conversationId, isWriting: true })
    }
  }, [isPending, webSocket, conversationId])

  const notifyStopcomposing = useCallback(() => {
    if (isPending) {
      return
    }

    composingNotificationTimeRef.current = 0
    webSocket?.send(WebSocketMessageType.ComposingStatus, { conversationId, isWriting: false })
  }, [isPending, webSocket, conversationId])

  const applyFormatting = useCallback(
    (prefix: string, suffix: string, placeholder: string) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart ?? 0
      const end = textarea.selectionEnd ?? 0
      const selected = currentMessage.substring(start, end)
      const text = selected || placeholder
      const newText = currentMessage.substring(0, start) + prefix + text + suffix + currentMessage.substring(end)
      setCurrentMessage(newText)
      notifyComposing()
      setTimeout(() => {
        textarea.focus()
        const selStart = start + prefix.length
        const selEnd = selStart + text.length
        textarea.setSelectionRange(selStart, selEnd)
      }, 0)
    },
    [currentMessage, notifyComposing],
  )

  const applyLinePrefix = useCallback(
    (linePrefix: string) => {
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart ?? 0
      const lineStart = currentMessage.lastIndexOf('\n', start - 1) + 1
      const alreadyHasPrefix = currentMessage.substring(lineStart).startsWith(linePrefix)
      let newText: string
      let newCursor: number
      if (alreadyHasPrefix) {
        newText = currentMessage.substring(0, lineStart) + currentMessage.substring(lineStart + linePrefix.length)
        newCursor = Math.max(lineStart, start - linePrefix.length)
      } else {
        newText = currentMessage.substring(0, lineStart) + linePrefix + currentMessage.substring(lineStart)
        newCursor = start + linePrefix.length
      }
      setCurrentMessage(newText)
      notifyComposing()
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(newCursor, newCursor)
      }, 0)
    },
    [currentMessage, notifyComposing],
  )

  const handleSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (currentMessage) {
        handleSendMessage(currentMessage)
        setCurrentMessage('')
        notifyStopcomposing()
      }
      if (fileHandlers.length > 0 && currentMessage === '') {
        handleSendMessage('files-to-send')
      }
    },
    [currentMessage, fileHandlers.length, handleSendMessage, notifyStopcomposing],
  )

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentMessage(event.target.value)
    notifyComposing()
  }

  const onEmojiSelected = (emoji: string) => setCurrentMessage((currentMessage) => currentMessage + emoji)

  const handleVoiceRecording = () => {
    setIsRecordingVoice((isRecordingVoice) => !isRecordingVoice)
    stopRecording(false)
  }

  const voiceRecordingStatusChange = () => {
    if (isRecordingVoice) {
      stopRecording(true)
    } else {
      startRecording()
      setFileHandlers([])
      setCurrentMessage('')
    }
    setIsRecordingVoice((isRecordingVoice) => !isRecordingVoice)
  }

  const sendAudioMessage = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: 'audio/ogg; codecs=opus' })
    const file = new File([blob], 'voicemessage.ogg', { type: 'audio/ogg; codecs=opus' })
    handleSendMessage('audio-message', file)
  }, [handleSendMessage])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioContextRef.current = new window.AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      analyserRef.current.fftSize = 2048
      const bufferLength = analyserRef.current.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)

      chunksRef.current = []
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data)
      mediaRecorderRef.current.onstop = () => {
        sendAudioMessage()
      }

      mediaRecorderRef.current.start()
      setCurrentTime(0)
      setStartTime(0)
      setFirstTime(-1)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }, [sendAudioMessage])

  const stopRecording = useCallback(
    (isCancel: boolean) => {
      if (mediaRecorderRef.current && isRecordingVoice) {
        if (isCancel) {
          mediaRecorderRef.current.onstop = null
        }
        setCurrentTime(0)
        setStartTime(0)
        setFirstTime(-1)
        mediaRecorderRef.current.stop()

        // stop and reset animation
        frameCountRef.current = 0
        waveformDataRef.current = []
        scrollOffsetRef.current = 0

        const tracks = mediaRecorderRef.current.stream.getTracks()
        tracks.forEach((track) => track.stop())
      }
    },
    [isRecordingVoice],
  )

  useEffect(() => {
    let animationFrameId: number

    const draw = (timestamp: number) => {
      if (startTime === null || startTime === undefined) setStartTime(timestamp)
      const calculatedTime = (timestamp - startTime) / 1000
      if (calculatedTime > 0 && firstTime === -1) setFirstTime(calculatedTime)
      setCurrentTime(calculatedTime - firstTime)

      const canvas = canvasRef.current
      if (canvas === null) return
      const ctx = canvas.getContext('2d')
      const width = canvas.width
      const height = canvas.height

      if (analyserRef.current === null || dataArrayRef.current === null) {
        return
      }

      // @ts-ignore -- Uint8Array<ArrayBuffer> requires TS ≥5.7; the runtime type is correct
      analyserRef.current.getByteFrequencyData(dataArrayRef.current)

      frameCountRef.current++
      if (frameCountRef.current % 8 === 0) {
        waveformDataRef.current.push({
          data: new Uint8Array(dataArrayRef.current),
          progress: 0,
        } as never)
      }

      if (ctx === null) {
        console.error('Canvas context is null')
        return
      }
      ctx.clearRect(0, 0, width, height)
      const barWidth = 5
      const gap = 3
      const amp = height * 0.9
      const minBarHeight = height * 0.15

      ctx.fillStyle = 'rgb(255, 255, 255)'

      let totalWidth = 0
      waveformDataRef.current.forEach((item: { progress: number; data: Uint8Array }) => {
        const x = totalWidth - scrollOffsetRef.current
        const rawBarHeight = (item.data[0] / 255) * amp
        const accentuatedHeight = Math.pow(rawBarHeight / amp, 0.5) * amp
        const barHeight = Math.max(minBarHeight, accentuatedHeight * item.progress)
        const y = height / 2 - barHeight / 2

        if (x + barWidth > 0 && x < width) {
          drawRoundedBar(ctx, x, y, barWidth, barHeight)
        }
        totalWidth += barWidth + gap
        item.progress = Math.min(item.progress + 0.2, 1)
      })

      if (totalWidth > width) {
        scrollOffsetRef.current += 0.3
        if (scrollOffsetRef.current >= barWidth + gap) {
          waveformDataRef.current.shift()
          scrollOffsetRef.current -= barWidth + gap
        }
      }

      if (isRecordingVoice) {
        animationFrameId = requestAnimationFrame(draw)
      }
    }

    const drawRoundedBar = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
      const radius = Math.min(width / 2, 2)
      ctx.beginPath()
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + width - radius, y)
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
      ctx.lineTo(x + width, y + height - radius)
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
      ctx.lineTo(x + radius, y + height)
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fill()
    }

    if (isRecordingVoice) {
      animationFrameId = requestAnimationFrame(draw)
    }
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isRecordingVoice, currentTime, startTime, firstTime])

  function getAudioWavePercentageWidth() {
    if (isMobile) {
      return '100%'
    } else if (isMedium) {
      return '90%'
    } else if (isMoreThanMedium) {
      return '80%'
    }
    return '70%'
  }

  function getAudioWavePixelWidth() {
    if (isMobile || isMedium) {
      return 100
    } else if (isMoreThanMedium) {
      return 400
    }
    return 700
  }

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: conversationColor,
    borderRadius: '20px',
    padding: '7px 20px',
    width: getAudioWavePercentageWidth(),
    justifyContent: 'space-between',
    boxSizing: 'border-box',
  }

  const waveformContainerStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    overflow: 'hidden',
    flexGrow: 1,
    margin: '0 10px',
    position: 'relative',
    width: '100%',
  }

  const durationStyles = {
    color: 'white',
    typography: 'body2',
    marginLeft: '10px',
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const mobileOptionStyles = {
    ml: '-3px',
    mr: '-3px',
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault()
      setCurrentMessage((prev) => prev + '\n')
    } else if (event.key === 'Enter') {
      event.preventDefault()
      handleSubmit(new Event('submit') as unknown as FormEvent<HTMLFormElement>)
    }
  }

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit}
      direction="row"
      spacing="5px"
      sx={{
        alignItems: 'center',
        paddingX: '8px',
        marginBottom: '0px',
      }}
    >
      {isRecordingVoice ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <div style={containerStyles}>
              <div style={waveformContainerStyles}>
                {/* canvas not responsible for now */}
                <canvas ref={canvasRef} width={getAudioWavePixelWidth()} height={30} style={{ display: 'block' }} />
              </div>
              <Box component="span" sx={durationStyles}>
                {formatTime(currentTime)}
              </Box>
            </div>
          </Box>
          <Tooltip title={t('button_cancel_voice_recording')}>
            <DeleteIcon
              onClick={voiceRecordingStatusChange}
              style={{ color: 'red', width: '30px', height: '30px', cursor: 'pointer' }}
            />
          </Tooltip>
          <BaseIconButton
            aria-label={t('button_send_message')}
            tooltip={t('button_send_message')}
            disabled={false}
            onClick={handleVoiceRecording}
          >
            <Arrow2Icon />
          </BaseIconButton>
        </>
      ) : (
        <Card
          variant="elevation"
          sx={{
            width: '100%',
            borderRadius: '20px',
            minWidth: '100px',
            boxShadow: (t) => t.shadows[2],
          }}
        >
          <CardContent
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 12px 0 12px',
              '&:last-child': { paddingBottom: '6px' },
            }}
          >
            <Stack
              sx={{
                flexGrow: 1,
              }}
            >
              <TextareaAutosize
                ref={textareaRef}
                value={currentMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                maxRows={4}
                style={{
                  font: 'inherit',
                  color: 'inherit',
                  width: '100%',
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  overflowY: 'auto',
                  backgroundColor: 'transparent',
                  textAlign: 'start',
                  whiteSpace: currentMessage ? 'pre-wrap' : 'nowrap',
                  textOverflow: currentMessage ? 'clip' : 'ellipsis',
                }}
              />
            </Stack>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: '2px', gap: '0px', flexWrap: 'nowrap' }}>
              <Tooltip title="Bold">
                <IconButton
                  size="small"
                  onClick={() => applyFormatting('**', '**', 'bold')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatBoldIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic">
                <IconButton
                  size="small"
                  onClick={() => applyFormatting('*', '*', 'italic')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatItalicIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Strikethrough">
                <IconButton
                  size="small"
                  onClick={() => applyFormatting('~~', '~~', 'strikethrough')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatStrikethroughIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Heading">
                <IconButton
                  size="small"
                  onClick={() => applyLinePrefix('# ')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatTitleIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Link">
                <IconButton
                  size="small"
                  onClick={() => applyFormatting('[', '](url)', 'link text')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <LinkIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Code">
                <IconButton
                  size="small"
                  onClick={() => applyFormatting('`', '`', 'code')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatCodeIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Quote">
                <IconButton
                  size="small"
                  onClick={() => applyLinePrefix('> ')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatQuoteIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Unordered list">
                <IconButton
                  size="small"
                  onClick={() => applyLinePrefix('- ')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatListBulletedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Ordered list">
                <IconButton
                  size="small"
                  onClick={() => applyLinePrefix('1. ')}
                  sx={{ fontSize: '18px', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <FormatListNumberedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              <Divider orientation="vertical" flexItem sx={{ mx: '4px', my: '4px' }} />
              <BaseIconButton
                aria-label={t('button_record_voice_message')}
                tooltip={t('button_record_voice_message')}
                sx={isReduced ? mobileOptionStyles : {}}
                onClick={voiceRecordingStatusChange}
                disabled={!!editMessage}
              >
                <MicroInBubbleIcon />
              </BaseIconButton>
              <BaseIconButton
                aria-label={t('button_record_video_message')}
                tooltip={t('button_record_video_message')}
                sx={isReduced ? mobileOptionStyles : {}}
                disabled={!!editMessage}
              >
                <CameraInBubbleIcon />
              </BaseIconButton>
              <BaseIconButton
                aria-label={t('button_upload_file')}
                tooltip={t('button_upload_file')}
                sx={isReduced ? mobileOptionStyles : {}}
                disabled={!!editMessage}
                onClick={openFilePicker}
              >
                <PaperClipIcon />
              </BaseIconButton>
              <SelectEmojiButton onEmojiSelected={onEmojiSelected} />
              <BaseIconButton
                aria-label={t('button_send_message')}
                tooltip={t('button_send_message')}
                sx={{ ml: '4px' }}
                disabled={!(currentMessage || fileHandlers.length > 0)}
                type="submit"
              >
                <Arrow2Icon />
              </BaseIconButton>
            </Box>
          </CardContent>
        </Card>
      )}
    </Stack>
  )
}

const usePlaceholder = (members: ConversationMember[]) => {
  const { account } = useAuthContext()
  const { t } = useTranslation()

  return useMemo(() => {
    const options: TranslateEnumerationOptions<ConversationMember> = {
      elementPartialKey: 'member',
      getElementValue: (member) => member.getDisplayName(),
      translaters: [
        () =>
          // The user is chatting with themself
          t('message_input_placeholder_1', { member0: account?.getDisplayName() }),
        (interpolations) => t('message_input_placeholder_1', interpolations),
        (interpolations) => t('message_input_placeholder_2', interpolations),
        (interpolations) => t('message_input_placeholder_3', interpolations),
        (interpolations) => t('message_input_placeholder_4', interpolations),
        (interpolations) => t('message_input_placeholder_more', interpolations),
      ],
    }

    return translateEnumeration<ConversationMember>(members, options)
  }, [account, members, t])
}
