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
import { Box, Chip, Divider, Link, Popper, Stack, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { styled, Theme, useTheme } from '@mui/material/styles'
import { darken } from '@mui/system'
import { Message, ReactionAdded, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import dayjs, { Dayjs } from 'dayjs'
import { AnimatePresence, motion } from 'framer-motion'
import { t } from 'i18next'
import Linkify from 'linkify-react'
import * as linkify from 'linkifyjs'
import {
  memo,
  type MouseEvent as ReactMouseEvent,
  ReactElement,
  ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useGlobalSetEditMessage } from '../contexts/ActionMessageProvider.js'
import { useGlobalSetReplyMessage } from '../contexts/ActionMessageProvider.js'
import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { useConversationPreferencesColorContext } from '../contexts/ConversationPreferencesColorContext.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { Account } from '../models/account.js'
import { Contact } from '../models/contact.js'
import { useDeleteMessageMutation } from '../services/conversationQueries.js'
import { GetDownloadedFile, useGetAutoDownloadLimit, useGetDownloadFileInfo } from '../services/dataTransferQueries.js'
import { useLinkPreviewQuery } from '../services/linkPreviewQueries.js'
import { getMessageCallText, getMessageMemberText } from '../utils/chatmessages.js'
import { formatRelativeDate, formatTime } from '../utils/dates&times.js'
import { type EmojiClickData, EmojiPicker } from '../utils/emojiPicker.js'
import {
  getPeerBubbleColor,
  getReplyBubbleColor,
  getReplyRing,
  getSentTimeColor,
  getTextColor,
} from '../utils/messagecolor.js'
import { isEmoji } from '../utils/utils.js'
import AudioPlayer from './AudioPlayer.js'
import BaseIconButton from './common/BaseIconButton.js'
import ConversationAvatar from './ConversationAvatar.js'
import LoadingPage from './Loading.js'
import MediaViewer from './MediaViewer.js'
import MessageDataContent from './MessageDataContent.js'
import MessageReaction from './MessageReaction.js'
import MessageStatus from './MessageStatus.js'
import PopoverList, { PopoverListItemData } from './PopoverList.js'
import {
  AddReactionIcon,
  Arrow3Icon,
  ArrowHeadDown,
  ArrowLeftCurved,
  ArrowLeftDown,
  ArrowRightUp,
  BlockContactIcon,
  DoorOpenIcon,
  DownloadFileIcon,
  ForwardIcon,
  OutgoingMailIcon,
  PenIcon,
  PeopleWithPlusSignIcon,
  TrashBinIcon,
  TwoSheetsIcon,
  WavingHandIcon,
} from './SvgIcon.js'
import TransferMessage from './TransferMessage.js'
import UseLongPress from './UseLongPress.js'

type MessagePosition = 'start' | 'end'

const notificationMessageTypes = ['initial', 'member'] as const
type NotificationMessageType = (typeof notificationMessageTypes)[number]
const checkIsNotificationMessageType = (type: Message['type'] | undefined): type is NotificationMessageType => {
  return notificationMessageTypes.includes(type as NotificationMessageType)
}

const invisibleMessageTypes = ['application/update-profile', 'merge', 'vote'] as const
type InvisibleMessageType = (typeof invisibleMessageTypes)[number]
const checkIsInvisibleMessageType = (type: Message['type'] | undefined): type is InvisibleMessageType => {
  return invisibleMessageTypes.includes(type as InvisibleMessageType)
}

const userMessageTypes = ['text/plain', 'application/data-transfer+json', 'application/call-history+json'] as const
type UserMessageType = (typeof userMessageTypes)[number]
const checkIsUserMessageType = (type: Message['type'] | undefined): type is UserMessageType => {
  return userMessageTypes.includes(type as UserMessageType)
}

const checkShowsTime = (time: Dayjs, previousTime: Dayjs) => {
  return !previousTime.isSame(time) && !time.isBetween(previousTime, previousTime?.add(1, 'minute'))
}

export const findPreviousVisibleMessage = (messages: Message[], messageIndex: number) => {
  for (let i = messageIndex + 1; i < messages.length; ++i) {
    const message = messages[i]
    if (!checkIsInvisibleMessageType(message?.type)) {
      return message
    }
  }
}

export const findNextVisibleMessage = (messages: Message[], messageIndex: number) => {
  for (let i = messageIndex - 1; i >= 0; --i) {
    const message = messages[i]
    if (!checkIsInvisibleMessageType(message?.type)) {
      return message
    }
  }
}

const avatarSize = '22px'
const spacingBetweenAvatarAndBubble = '10px'
const bubblePadding = '8px'
const messageActionHeight = 56

interface MessageCallProps {
  message: Message
  isAccountMessage: boolean
  isFirstOfGroup: boolean
  isLastOfGroup: boolean
}

const MessageCall = ({ message, isAccountMessage, isFirstOfGroup, isLastOfGroup }: MessageCallProps) => {
  const { i18n } = useTranslation()
  const position = isAccountMessage ? 'end' : 'start'
  const theme = useTheme()
  const { conversationColor } = useConversationPreferencesColorContext()
  const messageColor = isAccountMessage ? conversationColor : getPeerBubbleColor(theme)
  const darkColor = darken(messageColor, 0.3)

  const bubbleColor = isAccountMessage ? darkColor : getPeerBubbleColor(theme)
  const textColor = theme.palette.text.secondary

  const callDuration = dayjs.duration(parseInt(message?.duration || ''))
  const text = getMessageCallText(isAccountMessage, message, i18n)

  const Icon = callDuration.asSeconds() === 0 ? ArrowLeftCurved : isAccountMessage ? ArrowRightUp : ArrowLeftDown

  const isMissed = text === i18n.t('message_call_outgoing_missed') || text === i18n.t('message_call_incoming_missed')

  return (
    <Bubble
      position={position}
      isFirstOfGroup={isFirstOfGroup}
      isLastOfGroup={isLastOfGroup}
      bubbleColor={bubbleColor}
      isMedia={false}
      deleted={false} // deleted is not used in call message
    >
      <Stack
        direction="row"
        spacing="10px"
        sx={{
          alignItems: 'center',
          paddingLeft: '8px',
        }}
      >
        <Icon sx={{ fontSize: '20px', color: isMissed ? 'error.main' : textColor, marginLeft: '4px' }} />
        <Typography
          variant="body2"
          color={textColor}
          sx={{
            fontStyle: 'italic',
            fontWeight: 'bolder',
            textAlign: 'start',
            userSelect: 'none',
          }}
        >
          {text}
        </Typography>
      </Stack>
    </Bubble>
  )
}

const MessageInitial = () => {
  const { t } = useTranslation()
  const isReduced = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'))

  return (
    <Typography
      variant="body1"
      sx={{
        maxWidth: isReduced ? '200px' : 'unset',
      }}
    >
      {t('message_swarm_created')}
    </Typography>
  )
}

interface MessageDataTransferProps {
  message: Message
  isAccountMessage: boolean
  isFirstOfGroup: boolean
  isLastOfGroup: boolean
}

enum FileType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  Document = 'document',
}

const MessageDataTransfer = memo(
  ({ isAccountMessage, isFirstOfGroup, isLastOfGroup, message }: MessageDataTransferProps) => {
    const theme: Theme = useTheme()
    const { conversationId, members } = useConversationContext()
    const setReplyMessage = useGlobalSetReplyMessage()
    const { conversationColor } = useConversationPreferencesColorContext()
    const bubbleColor = isAccountMessage ? conversationColor : getPeerBubbleColor(theme)
    const [fileType, setFileType] = useState<FileType>()
    const extension = message.displayName?.split('.').pop()?.toLowerCase() || ''

    const downloadFile = GetDownloadedFile(conversationId)
    const limitData = useGetAutoDownloadLimit()
    const content = { messageId: message.id, fileId: message.fileId || '' }
    const isFileAlreadyInCache = useGetDownloadFileInfo({ content, conversationId })

    const [preview, setPreview] = useState<string>()
    const [audioBlob, setAudioBlob] = useState<Blob>()
    const [isMediaPreviewOpen, setIsMediaPreviewOpen] = useState(false)

    const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
    const isMedium: boolean = useMediaQuery(theme.breakpoints.only('sm'))

    const textColor = isAccountMessage ? 'white' : 'black'
    const position = isAccountMessage ? 'end' : 'start'
    const totalSize = Number(message.totalSize) / 1000000

    const isDeleted = message.fileId === ''
    const hasReactions = message.reactions.length > 0

    const member = members.find((member) => member.contact.uri === message.author)

    const getAudioBlob = useCallback(async () => {
      const result = await downloadFile.mutateAsync({ messageId: message.id, fileId: message.fileId || '' })
      if (!result) {
        return
      }
      const blob = new Blob([result.blob], { type: 'audio/' + extension.toLowerCase() })
      setAudioBlob(blob)
    }, [downloadFile, message.id, message.fileId, extension])

    const getPreview = useCallback(
      async (isImage: boolean) => {
        const result = await downloadFile.mutateAsync({ messageId: message.id, fileId: message.fileId || '' })
        if (!result || !result.blob) {
          return
        }
        const blob = new Blob([result.blob], {
          type: isImage ? 'image/' + extension.toLowerCase() : 'video/' + extension.toLowerCase(),
        })
        setPreview(URL.createObjectURL(blob))
      },
      [downloadFile, message.id, message.fileId, extension],
    )

    const checkFileType = useCallback(async () => {
      if (isDeleted || fileType !== undefined || !limitData.isSuccess || !isFileAlreadyInCache.isSuccess) {
        return
      }

      const acceptedAudioTypes = ['ogg', 'wav', 'mpeg', 'aac', 'flac', 'mp3']
      const acceptedImageTypes = ['apng', 'avif', 'jpg', 'JPG', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff']
      const acceptedVideoTypes = [
        'mp4',
        'webm',
        'mkv',
        'avi',
        'mov',
        'flv',
        'wmv',
        'm4v',
        '3gp',
        '3gpp',
        '3g2',
        '3gpp2',
      ]

      if (acceptedAudioTypes.includes(extension)) {
        setFileType(FileType.Audio)
        if (totalSize < limitData.data.limit || isFileAlreadyInCache.data) {
          await getAudioBlob()
        }
      } else if (acceptedImageTypes.includes(extension)) {
        setFileType(FileType.Image)
        if (totalSize < limitData.data.limit || isFileAlreadyInCache.data) {
          await getPreview(true)
        }
      } else if (acceptedVideoTypes.includes(extension)) {
        setFileType(FileType.Video)
        if (totalSize < limitData.data.limit || isFileAlreadyInCache.data) {
          await getPreview(false)
        }
      } else {
        setFileType(FileType.Document)
      }
    }, [
      isDeleted,
      fileType,
      limitData.isSuccess,
      limitData.data?.limit,
      isFileAlreadyInCache.isSuccess,
      isFileAlreadyInCache.data,
      extension,
      totalSize,
      getAudioBlob,
      getPreview,
    ])

    checkFileType()

    useEffect(() => {
      return () => {
        if (preview) {
          URL.revokeObjectURL(preview)
        }
      }
    }, [preview])

    if (message.fileId === undefined) {
      return null
    }

    const getMaxWidth = () => {
      if (isMobile) {
        return '250px'
      }
      if (isMedium) {
        return '300px'
      }
      return '550px'
    }

    const onDoubleClick = () => {
      if (isDeleted) {
        return
      }
      setReplyMessage(message)
    }

    const onMediaPreview = () => {
      if (!preview || isDeleted || fileType !== FileType.Image) {
        return
      }
      setIsMediaPreviewOpen(true)
    }

    const handleDownload = async () => {
      if (isDeleted) {
        return
      }

      //open download popup
      if (preview) {
        const link = document.createElement('a')
        link.href = preview
        link.setAttribute('href', preview)
        const fileName = message.displayName ? message.displayName : 'file'
        link.setAttribute('download', fileName)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        const result = await downloadFile.mutateAsync({ messageId: message.id, fileId: message.fileId || '' })
        if (!result || !result.blob) {
          return
        }
        const url = URL.createObjectURL(new Blob([result.blob]))
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('href', url)
        const fileName = message.displayName ? message.displayName : 'file'
        link.setAttribute('download', fileName)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }

    const dataComponent = () => {
      switch (fileType) {
        case FileType.Audio:
          if (!audioBlob) {
            return (
              <Box
                onClick={() => {
                  getAudioBlob()
                }}
              >
                <MessageDataContent
                  isAccountMessage={isAccountMessage}
                  displayName={message.displayName || 'Unknown'}
                  totalSize={Number(message.totalSize)}
                  isNotAvailable={true}
                />
              </Box>
            )
          }
          return (
            <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' }}>
              {position === 'end' && <Box sx={{ minWidth: '35px' }}></Box>}
              <AudioPlayer blob={audioBlob} isAccountMessage={isAccountMessage} />
              {position === 'start' && <Box sx={{ minWidth: '35px' }}></Box>}
            </Box>
          )
        case FileType.Image:
          if (!preview) {
            return (
              <Box
                onClick={() => {
                  getPreview(true)
                }}
              >
                <MessageDataContent
                  isAccountMessage={isAccountMessage}
                  displayName={message.displayName || 'Unknown'}
                  totalSize={Number(message.totalSize)}
                  isNotAvailable={true}
                />
              </Box>
            )
          }
          return (
            <img
              style={{ maxHeight: '250px', maxWidth: getMaxWidth(), borderRadius: '16px' }}
              src={preview}
              alt={message.displayName}
            />
          )
        case FileType.Video:
          if (!preview) {
            return (
              <Box
                onClick={() => {
                  getPreview(true)
                }}
              >
                <MessageDataContent
                  isAccountMessage={isAccountMessage}
                  displayName={message.displayName || 'Unknown'}
                  totalSize={Number(message.totalSize)}
                  isNotAvailable={true}
                />
              </Box>
            )
          }
          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignContent: 'center',
                alignItems: 'center',
              }}
            >
              <video style={{ maxWidth: getMaxWidth(), borderRadius: '16px' }} src={preview} controls />
            </Box>
          )
        default: // includes document
          return (
            <MessageDataContent
              isAccountMessage={isAccountMessage}
              displayName={message.displayName || 'Unknown'}
              totalSize={Number(message.totalSize)}
            />
          )
      }
    }

    return (
      <>
        {preview && (
          <MediaViewer
            blobUrl={preview}
            fileName={message.displayName}
            handleDownload={handleDownload}
            open={isMediaPreviewOpen}
            onClose={() => setIsMediaPreviewOpen(false)}
            member={member}
          />
        )}
        <Box sx={{ position: 'relative', width: 'fit-content', pb: hasReactions ? '18px' : 0 }}>
          <MessageTooltip
            isDeleted={isDeleted}
            position={position}
            message={message}
            isMedia={true}
            handleDownload={handleDownload}
          >
            <Box
              onClick={onMediaPreview}
              onDoubleClick={onDoubleClick}
              sx={isDeleted || fileType === FileType.Audio ? null : { cursor: 'pointer' }}
            >
              <Bubble
                bubbleColor={bubbleColor}
                position={position}
                isFirstOfGroup={isFirstOfGroup}
                isLastOfGroup={isLastOfGroup}
                isMedia={fileType !== FileType.Document && (preview || audioBlob) ? true : false}
                isAudio={fileType === FileType.Audio}
                deleted={isDeleted}
              >
                {isDeleted ? (
                  <Box
                    sx={{
                      color: textColor,
                      userSelect: 'none',
                    }}
                  >
                    {t('media_deleted')}
                  </Box>
                ) : (
                  dataComponent()
                )}
              </Bubble>
            </Box>
          </MessageTooltip>
          <MessageReaction message={message} position={position} />
        </Box>
      </>
    )
  },
)

interface MessageMemberProps {
  message: Message
}

const MessageMember = ({ message }: MessageMemberProps) => {
  const { i18n } = useTranslation()
  const theme: Theme = useTheme()
  const isReduced = useMediaQuery(theme.breakpoints.down('md'))

  const text = getMessageMemberText(message, i18n)
  const Icon =
    message.action === 'add'
      ? OutgoingMailIcon
      : message.action === 'unban'
        ? PeopleWithPlusSignIcon
        : message.action === 'join'
          ? WavingHandIcon
          : message.action === 'remove'
            ? DoorOpenIcon
            : message.action === 'ban'
              ? BlockContactIcon
              : PeopleWithPlusSignIcon

  return (
    <Chip
      sx={{
        maxWidth: isReduced ? '300px' : 'unset',
        width: 'fit-content',
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      }}
      icon={
        <Icon
          aria-hidden
          fontSize="small"
          sx={message.action === 'join' ? { transform: 'rotate(-20deg)' } : undefined}
        />
      }
      label={text}
    />
  )
}

type LinkPreviewProps = {
  isAccountMessage: boolean
  link: string
}

const LinkPreview = memo(({ isAccountMessage, link }: LinkPreviewProps) => {
  const [imageIsWorking, setImageIsWorking] = useState(true)
  const linkPreviewQuery = useLinkPreviewQuery(link)
  if (linkPreviewQuery.isLoading) {
    return <LoadingPage />
  }
  if (!linkPreviewQuery.isSuccess) {
    return null
  }
  const linkPreview = linkPreviewQuery.data

  return (
    <a href={link} style={{ textDecorationLine: 'none' }} target="_blank" rel="noopener noreferrer">
      <Stack>
        {imageIsWorking && linkPreview.image && (
          <img
            style={{
              width: '50%',
              borderRadius: '3px',
            }}
            alt={linkPreview.title}
            src={linkPreview.image}
            onError={() => setImageIsWorking(false)}
          />
        )}
        <Typography variant="body1" color={isAccountMessage ? '#cccccc' : 'black'}>
          {linkPreview.title}
        </Typography>
        {linkPreview.description && (
          <Typography variant="body1" sx={{ color: isAccountMessage ? '#ffffff' : '#005699' }}>
            {linkPreview.description}
          </Typography>
        )}
        <Typography variant="body1" color={isAccountMessage ? '#cccccc' : 'black'}>
          {new URL(link).hostname}
        </Typography>
      </Stack>
    </a>
  )
})

type RenderLinkProps = {
  attributes: {
    isAccountMessage: boolean
    href: string
  }
  content: ReactNode
}

const RenderLink = memo(({ attributes, content }: RenderLinkProps) => {
  const { href, isAccountMessage, ...props } = attributes
  return (
    <Link href={href} {...props} variant="body1" color={isAccountMessage ? '#ffffff' : undefined}>
      {content}
    </Link>
  )
})

interface MessageTextProps {
  message: Message
  isAccountMessage: boolean
  isFirstOfGroup: boolean
  isLastOfGroup: boolean
}

const MessageText = memo(({ message, isAccountMessage, isFirstOfGroup, isLastOfGroup }: MessageTextProps) => {
  const { conversationColor } = useConversationPreferencesColorContext()
  const theme: Theme = useTheme()

  const position = isAccountMessage ? 'end' : 'start'
  const bubbleColor = isAccountMessage ? conversationColor : getPeerBubbleColor(theme)
  const editedLabelColor = getSentTimeColor(getPeerBubbleColor(theme))
  const link = useMemo(() => linkify.find(message?.body ?? '', 'url')[0]?.href, [message])
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const isMedium: boolean = useMediaQuery(theme.breakpoints.only('md'))
  const isDeleted = message.body === ''
  const isEdited = message.editions !== undefined && message.editions.length > 0
  const hasReactions = message.reactions.length > 0
  const setReplyMessage = useGlobalSetReplyMessage()
  const [isPreviewEnabled] = useState(() => localStorage.getItem('linkPreview') === 'true')

  const onDoubleClick = () => {
    if (isDeleted) {
      return
    }
    setReplyMessage(message)
  }

  if (!isDeleted && message.body.length === 2 && isEmoji(message.body)) {
    return (
      <Box data-cy="message">
        <Box sx={{ position: 'relative', width: 'fit-content', pb: hasReactions ? '18px' : 0 }}>
          <MessageTooltip isDeleted={isDeleted} position={position} message={message} isMedia={false}>
            <Box sx={{ fontSize: '40px', padding: '4px' }}>{message.body}</Box>
          </MessageTooltip>
          <MessageReaction message={message} position={position} />
        </Box>
      </Box>
    )
  }

  return (
    <>
      <Box data-cy="message">
        <Box sx={{ width: 'fit-content' }}>
          <Box sx={{ position: 'relative', width: 'fit-content', pb: hasReactions ? '18px' : 0 }}>
            <MessageTooltip isDeleted={isDeleted} position={position} message={message} isMedia={false}>
              <Box onDoubleClick={() => onDoubleClick()}>
                <Bubble
                  bubbleColor={bubbleColor}
                  position={position}
                  isFirstOfGroup={isFirstOfGroup}
                  isLastOfGroup={isLastOfGroup}
                  maxWidth={isMobile ? '200px' : isMedium ? '380px' : '600px'}
                  deleted={isDeleted}
                  hasReply={message['reply-to'] !== undefined}
                >
                  <Linkify options={{ render: RenderLink as any, target: '_blank' }}>{message.body}</Linkify>
                  <Box>
                    {link && isPreviewEnabled && <LinkPreview isAccountMessage={isAccountMessage} link={link} />}
                  </Box>
                </Bubble>
              </Box>
            </MessageTooltip>
            <MessageReaction message={message} position={position} />
          </Box>
          {isEdited && !isDeleted && (
            <Box
              sx={{
                width: '100%',
                mt: hasReactions ? '-18px' : 0,
                ...(position === 'start' ? { pr: '20px', textAlign: 'right' } : { pl: '20px', textAlign: 'left' }),
                userSelect: 'none',
              }}
            >
              <Typography variant="caption" sx={{ color: editedLabelColor }}>
                {t('edited_message')}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </>
  )
})

interface DateIndicatorProps {
  time: Dayjs
}

const DateIndicator = ({ time }: DateIndicatorProps) => {
  const { i18n } = useTranslation()
  const textDate = useMemo(() => formatRelativeDate(time, i18n), [time, i18n])

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: '12px' }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          backgroundColor: 'rgba(0,0,0,0.06)',
          borderRadius: '16px',
          padding: '6px 16px',
          textTransform: 'capitalize',
          color: 'text.secondary',
        }}
      >
        {textDate}
      </Typography>
    </Box>
  )
}

interface TimeIndicatorProps {
  time: Dayjs
  hasDateOnTop: boolean
}

const TimeIndicator = ({ time, hasDateOnTop }: TimeIndicatorProps) => {
  const { i18n } = useTranslation()
  const textTime = useMemo(() => formatTime(time, i18n), [time, i18n])

  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: 'center',
        marginTop: hasDateOnTop ? '20px' : '30px',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: '#A7A7A7',
          fontWeight: 700,
        }}
      >
        {textTime}
      </Typography>
    </Stack>
  )
}

interface NotificationMessageRowProps {
  message: Message
}

const NotificationMessageRow = ({ message }: NotificationMessageRowProps) => {
  let messageComponent
  switch (message.type) {
    case 'initial':
      messageComponent = <MessageInitial />
      break
    case 'member':
      messageComponent = <MessageMember message={message} />
      break
    default:
      console.error(`${NotificationMessageRow.name} received unhandled message type: ${message.type}`)
      return null
  }

  return (
    <Stack
      sx={{
        paddingTop: '30px',
        alignItems: 'center',
      }}
    >
      {messageComponent}
    </Stack>
  )
}

interface UserMessageRowProps {
  message: Message
  isAccountMessage: boolean
  previousMessage: Message | undefined
  nextMessage: Message | undefined
  showsTime: boolean
  author: Account | Contact
}

const UserMessageRow = memo(
  ({ message, previousMessage, nextMessage, isAccountMessage, showsTime, author }: UserMessageRowProps) => {
    const authorName = author.getDisplayName()
    const position = isAccountMessage ? 'end' : 'start'
    const { t } = useTranslation()
    const previousIsUserMessageType = checkIsUserMessageType(previousMessage?.type)
    const nextIsUserMessageType = checkIsUserMessageType(nextMessage?.type)
    const nextTime = dayjs.unix(nextMessage?.timestamp || 0)
    const sentTime = dayjs.unix(message.timestamp)
    const nextShowsTime = checkShowsTime(nextTime, sentTime)
    const isFirstOfGroup = showsTime || !previousIsUserMessageType || previousMessage?.author !== message.author
    const isLastOfGroup = nextShowsTime || !nextIsUserMessageType || message.author !== nextMessage?.author
    const { members } = useConversationContext()
    const theme: Theme = useTheme()
    const isReduced = useMediaQuery(theme.breakpoints.down('md'))
    const isMobile = useMediaQuery(theme.breakpoints.only('xs'))
    const props = {
      message,
      isAccountMessage,
      isFirstOfGroup,
      isLastOfGroup,
    }
    let MessageComponent

    const replyMessage = message['reply-to']

    switch (message.type) {
      case 'text/plain':
        MessageComponent = MessageText
        break
      case 'application/data-transfer+json':
        MessageComponent = MessageDataTransfer
        break
      case 'application/call-history+json':
        MessageComponent = MessageCall
        break
      default:
        console.error(`${UserMessageRow.name} received unhandled message type: ${message.type}`)
        return null
    }

    const participantNamePadding = isAccountMessage
      ? bubblePadding
      : parseInt(avatarSize) + parseInt(spacingBetweenAvatarAndBubble) + parseInt(bubblePadding) + 'px'

    function scrollToMessage(messageId: string) {
      const messageElement = document.getElementById(`message-${messageId}`)
      if (messageElement) {
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    function highlightReplyMessage(messageId: string) {
      const replyMessageElement = document.getElementById(`message-${messageId}`)
      if (replyMessageElement) {
        replyMessageElement.style.transition = 'background-color 0.5s ease-in-out'
        replyMessageElement.style.backgroundColor = theme.palette.action.selected
        setTimeout(() => {
          replyMessageElement.style.backgroundColor = ''
        }, 1000)
      }
    }

    const getMaxReplyWidth = () => {
      if (isMobile) {
        return '300px'
      }
      if (isReduced) {
        return '400px'
      }
      return '600px'
    }

    let replyMessageComponent = <></>

    if (typeof replyMessage === 'object' && replyMessage !== undefined) {
      const member = members.find((member) => replyMessage?.author === member.contact.uri)
      const bubbleColorReply = getReplyBubbleColor(theme)
      const name = member === undefined ? t('yourself') : member.contact.getDisplayName()
      replyMessageComponent = (
        <Box
          sx={{ '&:hover': { cursor: 'pointer' } }}
          onClick={() => {
            scrollToMessage(replyMessage.id)
            highlightReplyMessage(replyMessage.id)
          }}
        >
          <Box sx={{ typography: 'caption', color: 'text.secondary', fontWeight: 'bolder', mt: 1, mr: 1.5, mb: 0 }}>
            {t('replied_to') + ' ' + name}
          </Box>
          <Box data-cy="reply-message" sx={{ mb: '-16px', mr: 1.5 }}>
            <Bubble
              bubbleColor={bubbleColorReply}
              position={position}
              isFirstOfGroup={true}
              isLastOfGroup={true}
              maxWidth={getMaxReplyWidth()}
              deleted={replyMessage.body === ''}
            >
              {replyMessage.type === 'text/plain' ? (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{
                    textAlign: position,
                  }}
                >
                  {replyMessage?.body === '' ? t('message_deleted') : replyMessage?.body}
                </Typography>
              ) : replyMessage.type === 'application/data-transfer+json' ? (
                <MessageDataContent
                  isReply={true}
                  displayName={replyMessage?.displayName || 'Unknown'}
                  totalSize={Number(replyMessage?.totalSize)}
                />
              ) : (
                t('cannot_load_messages')
              )}
            </Bubble>
          </Box>
        </Box>
      )
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Stack
          id={`message-${message.id}`}
          sx={{
            alignItems: position,
          }}
        >
          {isFirstOfGroup && (
            <Box
              sx={[
                {
                  padding: `0px ${participantNamePadding} 0 ${participantNamePadding}`,
                },
                isMobile
                  ? {
                      maxWidth: isAccountMessage ? 'unset' : '200px',
                      marginLeft: !isAccountMessage ? '-8px' : '0',
                    }
                  : {},
              ]}
            >
              <ParticipantName name={authorName} position={position} sentTime={sentTime} />
            </Box>
          )}
          <Box sx={isAccountMessage ? { marginRight: '24px' } : { marginLeft: '48px' }}>{replyMessageComponent}</Box>

          <Stack
            direction="row"
            spacing={spacingBetweenAvatarAndBubble}
            sx={{
              justifyContent: position,
              alignItems: 'end',
              paddingTop: '6px',
              width: '66.66%',
              zIndex: 1,
            }}
          >
            <Box sx={{ width: avatarSize }}>
              {!isAccountMessage && isLastOfGroup && (
                <ConversationAvatar
                  contactUri={'uri' in author ? author.uri : ''}
                  displayName={authorName}
                  sx={{ width: avatarSize, height: avatarSize, fontSize: '10px' }}
                />
              )}
            </Box>
            <motion.div
              initial={message.animate ? { rotate: isAccountMessage ? 5 : -5, scale: 0.8, y: -10 } : undefined}
              animate={message.animate ? { rotate: 0, scale: 1, y: 0 } : undefined}
              transition={
                message.animate
                  ? {
                      type: 'spring',
                      stiffness: 300,
                      damping: 10,
                    }
                  : undefined
              }
            >
              <MessageComponent {...props} />
            </motion.div>
          </Stack>
        </Stack>
        {isAccountMessage && <MessageStatus message={message} />}
      </Box>
    )
  },
)

interface MessageTooltipProps {
  className?: string
  position: MessagePosition
  children: ReactElement
  message: Message
  isDeleted: boolean
  isMedia: boolean
  handleDownload?: () => void
}

const MessageTooltip = styled(
  memo(({ message, className, position, children, isDeleted, isMedia, handleDownload }: MessageTooltipProps) => {
    const hoverCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const { conversationId } = useConversationContext()
    const webSocket = useWebSocketContext()
    const { account } = useAuthContext()
    const [open, setOpen] = useState(false)
    const [transferModalOpen, setTransferModalOpen] = useState(false)
    const [emojiIsOpen, setEmojiIsOpen] = useState(false)
    const [emojiPickerAnchorEl, setEmojiPickerAnchorEl] = useState<HTMLButtonElement | null>(null)
    const setReplyMessage = useGlobalSetReplyMessage()
    const setEditMessage = useGlobalSetEditMessage()

    const [tooltipOpen, setTooltipOpen] = useState(false)
    const deleteMessageMutation = useDeleteMessageMutation(conversationId)
    const theme = useTheme()
    const { t } = useTranslation()
    const isMobile = useMediaQuery(theme.breakpoints.only('xs'))
    const { setAlertContent } = use(AlertSnackbarContext)

    const handleLongPress = useCallback(() => {
      if (!isMobile) return
      setTooltipOpen(true)
    }, [isMobile])

    const longPressProps = UseLongPress(handleLongPress, 500)

    const onClose = () => {
      setOpen(false)
      setEmojiIsOpen(false)
      setEmojiPickerAnchorEl(null)
    }

    const closeTooltip = () => {
      clearTimeout(hoverCloseTimeoutRef.current)
      setTooltipOpen(false)
      onClose()
    }

    const scheduleTooltipClose = () => {
      clearTimeout(hoverCloseTimeoutRef.current)
      hoverCloseTimeoutRef.current = setTimeout(closeTooltip, 200)
    }

    useEffect(() => {
      const handleClickOutside = (event: TouchEvent) => {
        const target = event.target as Element | null
        if (target && !target.closest('.MuiTooltip-tooltip, .message-emoji-picker')) {
          setTooltipOpen(false)
          onClose()
        }
      }

      document.addEventListener('touchstart', handleClickOutside)
      return () => {
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }, [])

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element | null
        if (target && !target.closest('.MuiTooltip-tooltip, .message-emoji-picker')) {
          setTooltipOpen(false)
          onClose()
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [])

    useEffect(() => {
      return () => {
        clearTimeout(hoverCloseTimeoutRef.current)
      }
    }, [])

    // No actions if message is deleted
    if (isDeleted) {
      return <>{children}</>
    }

    const handleCopyMessage = () => {
      navigator.clipboard.writeText(message.body)
      setAlertContent({
        messageI18nKey: 'message_content_copied',
        severity: 'success',
        alertOpen: true,
      })
    }

    const handleTransfer = () => {
      setTransferModalOpen(true)
    }

    const handleTransferClose = () => {
      setTransferModalOpen(false)
    }

    const additionalOptions: PopoverListItemData[] = [
      {
        Icon: ForwardIcon,
        iconColor: 'inherit',
        iconSize: '22px',
        label: 'Forward',
        onClick: handleTransfer,
      },
    ]

    if (isMedia) {
      additionalOptions.push({
        Icon: DownloadFileIcon,
        iconColor: 'inherit',
        iconSize: '22px',
        label: 'Download',
        onClick: () => {
          if (handleDownload) {
            handleDownload()
          }
        },
      })
    } else {
      additionalOptions.push({
        Icon: TwoSheetsIcon,
        iconColor: 'inherit',
        iconSize: '22px',
        label: 'Copy',
        onClick: handleCopyMessage,
      })
    }

    if (account.getUri() === message.author) {
      additionalOptions.push({
        Icon: TrashBinIcon,
        iconColor: 'inherit',
        iconSize: '22px',
        label: 'Delete message',
        onClick: () => {
          deleteMessageMutation.mutate(message.id)
        },
      })
    }

    const toggleMoreMenu = () => setOpen((open) => !open)
    const messageActionButtonSx = {
      fontSize: '22px',
      height: '24px',
      width: '24px',
    }

    const onEmojiClickHandler = (event: ReactMouseEvent<HTMLButtonElement>) => {
      setEmojiPickerAnchorEl(event.currentTarget)
      setEmojiIsOpen(true)
    }

    function onReply() {
      setEditMessage(undefined)
      setReplyMessage(message)
      closeTooltip()
    }

    function onEdit() {
      setReplyMessage(undefined)
      setEditMessage(message)
      closeTooltip()
    }

    function onEmojiSelected(emoji: string) {
      for (const reaction of message.reactions) {
        if (reaction.author === account.getUri() && reaction.body === emoji) {
          if (reaction.id === undefined) {
            console.error('reaction id is undefined')
          } else {
            webSocket.send(WebSocketMessageType.ReactionRemoved, {
              conversationId,
              messageId: message.id,
              reactionId: reaction.id,
            })
          }
          return
        }
      }
      const data: ReactionAdded = {
        accountId: account.id,
        conversationId: conversationId,
        messageId: message.id,
        reaction: {
          author: account.id,
          body: emoji,
          timestamp: dayjs().unix().toString(),
          parents: message.id,
          'react-to': message.id,
        },
      }
      webSocket.send(WebSocketMessageType.ReactionAdded, data)
    }
    const onEmojiClick = (emoji: EmojiClickData, _: MouseEvent) => {
      onEmojiSelected(emoji.emoji)
      setEmojiIsOpen(false)
      closeTooltip()
    }
    const handleMouseEnter = () => {
      if (isMobile) return
      clearTimeout(hoverCloseTimeoutRef.current)
      setTooltipOpen(true)
    }

    // No actions if message is deleted
    if (isDeleted) {
      return <>{children}</>
    }

    return (
      <>
        <Tooltip
          classes={{ tooltip: className }}
          placement={position === 'start' ? 'right-start' : 'left-start'}
          open={tooltipOpen}
          disableHoverListener
          disableFocusListener
          disableTouchListener={!isMobile}
          title={
            <div onMouseLeave={scheduleTooltipClose} onMouseEnter={handleMouseEnter}>
              <Stack
                direction="row"
                spacing="16px"
                sx={{
                  padding: '16px',
                  cursor: 'pointer',
                }}
              >
                <BaseIconButton
                  data-cy="emoji-reaction-button"
                  aria-label={t('message_react')}
                  tooltip={t('message_react')}
                  sx={messageActionButtonSx}
                  onClick={onEmojiClickHandler}
                >
                  <AddReactionIcon fontSize="inherit" />
                </BaseIconButton>
                <BaseIconButton
                  data-cy="reply-button"
                  aria-label={t('message_reply')}
                  tooltip={t('message_reply')}
                  sx={messageActionButtonSx}
                  onClick={onReply}
                >
                  <Arrow3Icon fontSize="inherit" />
                </BaseIconButton>
                {account.getUri() === message.author && (
                  <BaseIconButton
                    data-cy="edit-button"
                    aria-label={t('message_edit')}
                    tooltip={t('message_edit')}
                    sx={messageActionButtonSx}
                    onClick={onEdit}
                  >
                    <PenIcon fontSize="inherit" />
                  </BaseIconButton>
                )}
                <BaseIconButton
                  aria-label={t('message_more_options')}
                  tooltip={open ? 'Less' : 'More'}
                  sx={{
                    ...messageActionButtonSx,
                    '&:active': { color: theme.palette.common.white, background: theme.palette.primary.dark },
                  }}
                  onClick={toggleMoreMenu}
                >
                  <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    style={{ display: 'inline-flex' }}
                  >
                    <ArrowHeadDown fontSize="inherit" />
                  </motion.span>
                </BaseIconButton>
              </Stack>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    initial={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                  >
                    <Divider sx={{ marginX: '16px' }} />
                    <PopoverList items={additionalOptions} onClose={() => closeTooltip()} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          }
          slotProps={{
            popper: {
              modifiers: [
                {
                  name: 'offset',
                  options: {
                    offset: ({ reference }: { reference: { height: number } }) => [
                      reference.height / 2 - messageActionHeight / 2,
                      -2,
                    ],
                  },
                },
              ],
            },
          }}
        >
          <div {...longPressProps} onMouseEnter={handleMouseEnter} onMouseLeave={scheduleTooltipClose}>
            {children}
          </div>
        </Tooltip>
        <Popper anchorEl={emojiPickerAnchorEl} open={emojiIsOpen} placement="bottom-start" sx={{ zIndex: 2 }}>
          <Box className="message-emoji-picker" onMouseEnter={handleMouseEnter} onMouseLeave={scheduleTooltipClose}>
            <EmojiPicker
              theme={theme.EmojiPicker.backgroundColor}
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              skinTonesDisabled={true}
            />
          </Box>
        </Popper>
        <TransferMessage
          conversationId={conversationId}
          message={message}
          onClose={handleTransferClose}
          open={transferModalOpen}
        />
      </>
    )
  }),
)(({ position, theme }) => {
  const largeRadius = '20px'
  const smallRadius = '5px'
  return {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    padding: '0px',
    boxShadow: '3px 3px 7px #00000029',
    borderRadius: largeRadius,
    borderStartStartRadius: position === 'start' ? smallRadius : largeRadius,
    borderStartEndRadius: position === 'end' ? smallRadius : largeRadius,
    overflow: 'hidden',
  }
})

interface BubbleProps {
  position: MessagePosition
  isFirstOfGroup: boolean
  isLastOfGroup: boolean
  bubbleColor: string
  maxWidth?: string
  children: ReactNode
  deleted: boolean
  isMedia?: boolean
  isAudio?: boolean
  hasReply?: boolean
}

const Bubble = memo(
  ({
    position,
    isFirstOfGroup,
    isLastOfGroup,
    bubbleColor,
    maxWidth,
    children,
    deleted,
    isMedia,
    isAudio,
    hasReply,
  }: BubbleProps) => {
    const { t } = useTranslation()
    const largeRadius = '20px'
    const smallRadius = '8px'
    const theme = useTheme()
    const radius = useMemo(() => {
      if (position === 'start') {
        return {
          borderStartStartRadius: isFirstOfGroup ? largeRadius : smallRadius,
          borderStartEndRadius: largeRadius,
          borderEndStartRadius: isLastOfGroup ? largeRadius : smallRadius,
          borderEndEndRadius: largeRadius,
        }
      }
      return {
        borderStartStartRadius: largeRadius,
        borderStartEndRadius: isFirstOfGroup ? largeRadius : smallRadius,
        borderEndStartRadius: largeRadius,
        borderEndEndRadius: isLastOfGroup ? largeRadius : smallRadius,
      }
    }, [isFirstOfGroup, isLastOfGroup, position])
    const nonMediaBubbleStyle = {
      border: hasReply ? getReplyRing(theme) : 'unset',
      color: position === 'start' ? theme.palette.text.primary : getTextColor(bubbleColor),
      maxWidth: maxWidth || '100%',
      backgroundColor: bubbleColor,
      padding: isMedia && !deleted ? null : bubblePadding,
      overflow: 'hidden',
      wordWrap: 'break-word',
      textWrap: 'wrap',
      display: 'flex',
      flexWrap: 'wrap',
      whiteSpace: 'pre-wrap',
      marginRight: '8px',
      overflowWrap: 'break-word',
      wordBreak: 'break-word',
      height: 'auto',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      ...radius,
    }
    const mediaBubbleStyle = {
      paddingTop: '15px',
      marginRight: isAudio && position === 'start' ? '-25px' : '8px',
    }
    const messageContentBubbleStyle = {
      wordWrap: 'break-word',
    }
    const deletedMessageStyle = {
      color: theme.palette.text.disabled,
      fontStyle: 'italic',
      backgroundColor: darken(bubbleColor, 0.5),
    }

    const messageStyles = deleted
      ? { ...nonMediaBubbleStyle, ...deletedMessageStyle }
      : isMedia
        ? mediaBubbleStyle
        : nonMediaBubbleStyle

    return (
      <Box>
        <Box sx={messageStyles}>
          <Box
            sx={
              isMedia && !deleted
                ? { userSelect: deleted ? 'none' : 'auto' }
                : { ...messageContentBubbleStyle, userSelect: deleted ? 'none' : 'auto' }
            }
          >
            {deleted ? t(isMedia ? 'media_deleted' : 'message_deleted') : children}
          </Box>
        </Box>
      </Box>
    )
  },
)

interface ParticipantNameProps {
  name: string
  position: MessagePosition
  sentTime: Dayjs
}

const ParticipantName = ({ name, position, sentTime }: ParticipantNameProps) => {
  const theme = useTheme()

  return (
    <Stack direction={position === 'start' ? 'row' : 'row-reverse'} spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.secondary,
          fontWeight: 700,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </Typography>
      <Typography
        data-cy="message-sent-time"
        variant="caption"
        sx={{ color: theme.palette.text.secondary, flexShrink: 0, fontSize: '0.6875rem' }}
      >
        {sentTime.format('h:mm a')}
      </Typography>
    </Stack>
  )
}

interface MessageProps {
  message: Message
  isAccountMessage: boolean
  author: Account | Contact
  previousMessage?: Message | undefined
  nextMessage?: Message | undefined
}

export const MessageRow = memo(({ message, isAccountMessage, author, previousMessage, nextMessage }: MessageProps) => {
  const time = dayjs.unix(message.timestamp)
  const previousTime = dayjs.unix(previousMessage?.timestamp || 0)
  const showDate =
    message?.type === 'initial' || previousTime.year() !== time.year() || previousTime.dayOfYear() !== time.dayOfYear()
  const showTime = checkShowsTime(time, previousTime)

  let messageComponent
  if (checkIsUserMessageType(message.type)) {
    messageComponent = (
      <UserMessageRow
        message={message}
        previousMessage={previousMessage}
        nextMessage={nextMessage}
        showsTime={showTime}
        isAccountMessage={isAccountMessage}
        author={author}
      />
    )
  } else if (checkIsNotificationMessageType(message.type)) {
    messageComponent = <NotificationMessageRow message={message} />
  } else if (checkIsInvisibleMessageType(message.type)) {
    return null
  } else {
    const _exhaustiveCheck: never = message.type
    return _exhaustiveCheck
  }

  return (
    <Stack
      sx={{
        zIndex: 2,
      }}
    >
      {showDate && (
        <Box sx={{ mt: '15px', mb: '15px' }}>
          <DateIndicator time={time} />
        </Box>
      )}
      {showTime && (
        <Box sx={{ mt: '15px', mb: '15px' }}>
          <TimeIndicator time={time} hasDateOnTop={showDate} />
        </Box>
      )}
      {messageComponent}
    </Stack>
  )
})
