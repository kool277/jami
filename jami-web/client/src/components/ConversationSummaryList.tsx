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
import { Box, List, Stack, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IConversationSummary, MAX_UNREAD_MESSAGE_COUNT, WebSocketMessageType } from '@savoirfairelinux/jami-web-common'
import { MessageStatusCode } from '@savoirfairelinux/jami-web-common/src/enums/message-status-code'
import dayjs from 'dayjs'
import { ReactNode, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useCallManagerContext } from '../contexts/CallManagerProvider.js'
import { useWebSocketContext } from '../contexts/WebSocketProvider.js'
import { useConversationDisplayNameShort } from '../hooks/useConversationDisplayName.js'
import { useUrlParams } from '../hooks/useUrlParams.js'
import { ConversationRouteParams } from '../router.js'
import { CallStatus } from '../services/CallManager.js'
import { useBlockContactMutation, useContactQuery } from '../services/contactQueries.js'
import {
  useConversationPreferencesMutation,
  useConversationPreferencesQuery,
  useMarkConversationSummaryRead,
  useMembersQuery,
} from '../services/conversationQueries.js'
import { getMessageCallText, getMessageMemberText } from '../utils/chatmessages.js'
import { isConversationUnread } from '../utils/conversationFilters.js'
import { formatConversationDate } from '../utils/dates&times.js'
import { getFileType } from '../utils/fileTypes.js'
import { getColor } from '../utils/messagecolor.js'
import ContactDetailDialog from './ContactDetailDialog.js'
import ContextMenu, { ContextMenuHandler, useContextMenuHandler } from './ContextMenu.js'
import ConversationAvatar, { GroupConversationAvatar } from './ConversationAvatar.js'
import { CustomListItemButton } from './CustomListItemButton.js'
import { ConfirmationDialog, DialogContentList, InfosDialog, useDialogHandler } from './Dialog.js'
import JamiQrCode from './JamiQrCode.js'
import MaterialSymbol from './MaterialSymbol.js'
import { PopoverListItemData } from './PopoverList.js'
import RemoveConversationDialog from './RemoveComversationDialog.js'
import {
  AudioCallIcon,
  BlockContactIcon,
  ExitToAppIcon,
  MarkChatReadIcon,
  NotificationsActiveIcon,
  NotificationsOffIcon,
  OpenInNewIcon,
  PersonIcon,
  VideoCallIcon,
} from './SvgIcon.js'

type ConversationSummaryListProps = {
  conversationsSummaries: IConversationSummary[]
}

export const ConversationSummaryList = ({ conversationsSummaries }: ConversationSummaryListProps) => {
  const sortedConversations = useMemo(() => {
    if (!conversationsSummaries || conversationsSummaries.length === 0) {
      return []
    }

    if (conversationsSummaries.length === 1) {
      return conversationsSummaries
    }

    if (conversationsSummaries.some((conversationSummary) => conversationSummary === null)) {
      return conversationsSummaries
    }
    return [...conversationsSummaries].sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0))
  }, [conversationsSummaries])

  return (
    <List
      sx={{
        flexShrink: 0,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {sortedConversations?.map(
        (conversationSummary) =>
          conversationSummary !== null && (
            <ConversationSummaryListItem key={conversationSummary.id} conversationSummary={conversationSummary} />
          ),
      )}
    </List>
  )
}
type ConversationSummaryListItemProps = {
  conversationSummary: IConversationSummary
}

export const getConversationContactUri = (mode: string | undefined, memberUris: string[]): string | undefined =>
  Number(mode) === 0 ? memberUris[0] : undefined

const ConversationSummaryListItem = ({ conversationSummary }: ConversationSummaryListItemProps) => {
  const { account } = useAuthContext()
  const {
    urlParams: { conversationId: selectedConversationId },
  } = useUrlParams<ConversationRouteParams>()
  const contextMenuHandler = useContextMenuHandler()
  const navigate = useNavigate()
  const members = useMembersQuery(conversationSummary.id)
  const memberArray = members.data
  const theme = useTheme()
  const filteredMembers = useMemo(() => {
    return memberArray?.filter((member) => member.contact.uri !== account.getUri()) || []
  }, [memberArray, account])

  const conversationId = conversationSummary.id
  const isSelected = conversationId === selectedConversationId
  const isUnread = isConversationUnread(conversationSummary)
  const onClick = () => {
    if (conversationId) {
      navigate(`/conversation/${conversationId}`)
    }
  }

  const conversationName = useConversationDisplayNameShort(
    account,
    conversationSummary.title,
    conversationSummary.membersNames,
  )

  return (
    <Box>
      <ConversationMenu
        conversationMemberUri={getConversationContactUri(
          conversationSummary.mode,
          filteredMembers.map((member) => member.contact.uri),
        )}
        conversationAvatar={conversationSummary.avatar}
        conversationId={conversationId}
        conversationName={conversationName}
        lastMessageId={conversationSummary.lastMessage?.id}
        hasUnreadMessages={isUnread}
        isSelected={isSelected}
        contextMenuProps={contextMenuHandler.props}
      />
      <CustomListItemButton
        selected={isSelected}
        onClick={onClick}
        onContextMenu={contextMenuHandler.handleAnchorPosition}
        icon={
          Number(conversationSummary.mode) !== 0 ? (
            <GroupConversationAvatar
              displayName={conversationName}
              members={memberArray || []}
              src={conversationSummary.avatar}
            />
          ) : (
            <ConversationAvatar
              presence={true}
              presenceBackgroundColor={isSelected ? theme.palette.primary.light : undefined}
              contactUri={
                Number(conversationSummary.mode) === 0 && filteredMembers.length > 0
                  ? filteredMembers[0].contact.uri
                  : ''
              }
              displayName={conversationName}
              src={conversationSummary.avatar}
            />
          )
        }
        primaryText={
          <Stack
            direction="row"
            sx={{
              alignItems: 'center',
              width: '100%',
              minWidth: 0,
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                noWrap
                title={conversationName}
                sx={{ minWidth: 0, flex: 1, fontWeight: isUnread ? 'bold' : 'normal' }}
              >
                {conversationName}
              </Typography>
            </Box>
            <TimeIndicator conversationSummary={conversationSummary} />
          </Stack>
        }
        secondaryText={<SecondaryText conversationSummary={conversationSummary} />}
      />
    </Box>
  )
}

type SecondaryTextProps = {
  conversationSummary: IConversationSummary
}

const TimeIndicator = ({ conversationSummary }: { conversationSummary: IConversationSummary }) => {
  const { i18n } = useTranslation()
  const timeIndicator = useMemo(() => {
    const message = conversationSummary.lastMessage
    if (!message?.timestamp) {
      return ''
    }
    const time = dayjs.unix(Number(message.timestamp))
    return formatConversationDate(time, i18n)
  }, [conversationSummary, i18n])

  return (
    <Typography
      variant="caption"
      sx={{
        color: 'text.secondary',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {timeIndicator}
    </Typography>
  )
}

const SecondaryText = ({ conversationSummary }: SecondaryTextProps) => {
  const { account } = useAuthContext()
  const { callData, callStatus, isAudioOn } = useCallManagerContext()
  const { t, i18n } = useTranslation()

  const isRead = !isConversationUnread(conversationSummary)

  const lastMessageText = useMemo<ReactNode>(() => {
    if (!callData || callData.conversationId !== conversationSummary.id) {
      const message = conversationSummary.lastMessage
      if (!message) {
        return ''
      }
      switch (message.type) {
        case 'initial': {
          return t('message_swarm_created')
        }
        case 'application/data-transfer+json': {
          const fileType = getFileType(message.displayName)
          return (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                gap: 0.5,
              }}
            >
              <MaterialSymbol
                symbol={
                  fileType === 'image'
                    ? 'image'
                    : fileType === 'video'
                      ? 'smart_display'
                      : fileType === 'audio'
                        ? 'mic'
                        : 'attachment'
                }
                weight={isRead ? 300 : 500}
                aria-hidden="true"
                sx={{
                  fontSize: '1rem',
                  display: 'inline-flex',
                  flexShrink: 0,
                  lineHeight: 1,
                  marginLeft: 0,
                  marginRight: '2px',
                }}
              />
              <Typography component="span" variant="inherit" noWrap sx={{ minWidth: 0 }}>
                {message.displayName}
              </Typography>
            </Box>
          )
        }
        case 'application/call-history+json': {
          const isAccountMessage = message.author === account.getUri()
          const isMissed = Number(message.duration) === 0
          const iconSymbol = isMissed ? 'call_missed' : isAccountMessage ? 'call_made' : 'call_received'

          return (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto minmax(0, 1fr)',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                gap: 0.5,
              }}
            >
              <MaterialSymbol
                symbol={iconSymbol}
                bidirectional
                weight={isRead ? 300 : 500}
                aria-hidden="true"
                sx={{
                  fontSize: '1rem',
                  flexShrink: 0,
                  lineHeight: 1,
                  marginRight: '2px',
                  transform: isMissed && isAccountMessage ? 'scaleX(-1)' : undefined,
                }}
              />
              <Typography component="span" variant="inherit" noWrap sx={{ minWidth: 0 }}>
                {getMessageCallText(isAccountMessage, message, i18n)}
              </Typography>
            </Box>
          )
        }
        case 'member': {
          return (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: ['add', 'join', 'remove'].includes(message.action ?? '')
                  ? 'auto minmax(0, 1fr)'
                  : 'minmax(0, 1fr)',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                gap: 0.5,
              }}
            >
              {(['add', 'join', 'remove'] as const).includes(message.action as 'add' | 'join' | 'remove') && (
                <MaterialSymbol
                  symbol={
                    message.action === 'add' ? 'person_add' : message.action === 'join' ? 'waving_hand' : 'door_open'
                  }
                  weight={isRead ? 300 : 500}
                  aria-hidden="true"
                  sx={{
                    fontSize: '1rem',
                    display: 'inline-flex',
                    flexShrink: 0,
                    lineHeight: 1,
                    marginLeft: 0,
                    marginRight: '2px',
                    overflow: 'visible',
                    transform: message.action === 'join' ? 'rotate(-20deg)' : undefined,
                  }}
                />
              )}
              <Typography component="span" variant="inherit" noWrap sx={{ minWidth: 0 }}>
                {getMessageMemberText(message, i18n)}
              </Typography>
            </Box>
          )
        }
        case 'text/plain': {
          return message.body
        }
        case 'application/update-profile': {
          return message.body
        }
        default: {
          console.error(`${ConversationSummaryListItem.name} received an unexpected lastMessage type: ${message.type}`)
          return ''
        }
      }
    }

    if (callStatus === CallStatus.InCall) {
      return isAudioOn ? t('ongoing_call_unmuted') : t('ongoing_call_muted')
    }

    if (callStatus === CallStatus.Connecting) {
      return t('connecting_call')
    }

    return callData.role === 'caller' ? t('outgoing_call') : t('incoming_call')
  }, [account, conversationSummary, callData, callStatus, isAudioOn, isRead, t, i18n])

  const lastMessageStyle = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <Stack direction="row" sx={{ alignItems: 'center', minWidth: 0, gap: 1 }}>
      <Typography
        component="div"
        variant="body2"
        sx={[
          {
            color: 'text.secondary',
            fontWeight: isRead ? 'normal' : 'bold',
            minWidth: 0,
            flex: 1,
          },
          ...(Array.isArray(lastMessageStyle) ? lastMessageStyle : [lastMessageStyle]),
        ]}
      >
        {lastMessageText}
      </Typography>
      {conversationSummary.unreadMessages > 0 && (
        <Box
          aria-label={t('unread_messages', { count: conversationSummary.unreadMessages })}
          sx={{
            minWidth: '18px',
            height: '18px',
            px: '4px',
            flexShrink: 0,
            borderRadius: '9px',
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: '0.6875rem',
            fontWeight: 'bold',
            lineHeight: '18px',
            textAlign: 'center',
          }}
        >
          {conversationSummary.unreadMessages >= MAX_UNREAD_MESSAGE_COUNT
            ? `${MAX_UNREAD_MESSAGE_COUNT}+`
            : conversationSummary.unreadMessages}
        </Box>
      )}
    </Stack>
  )
}

interface ConversationMenuProps {
  conversationId: string
  conversationName: string
  lastMessageId?: string
  hasUnreadMessages: boolean
  isSelected: boolean
  contextMenuProps: ContextMenuHandler['props']
  conversationAvatar?: string
  conversationMemberUri?: string
}

interface ConversationMenuOptionParams {
  conversationId: string
  conversationMemberUri?: string
  isMuted: boolean
  hasUnreadMessages: boolean
  isMutePreferenceReady: boolean
  translate: (key: string) => string
  startCall: (conversationId: string, withVideoOn?: boolean) => void
  openConversation: () => void
  openInNewTab: () => void
  toggleMute: () => void
  markConversationRead: () => void
  openContactInfo: () => void
  leaveConversation: () => void
  blockConversation: () => void
}

export const createConversationMenuOptions = ({
  conversationId,
  conversationMemberUri,
  isMuted,
  hasUnreadMessages,
  isMutePreferenceReady,
  translate,
  startCall,
  openConversation,
  openInNewTab,
  toggleMute,
  markConversationRead,
  openContactInfo,
  leaveConversation,
  blockConversation,
}: ConversationMenuOptionParams): PopoverListItemData[] => [
  {
    label: translate('conversation_audio_call'),
    Icon: AudioCallIcon,
    onClick: () => {
      startCall(conversationId)
      openConversation()
    },
  },
  {
    label: translate('conversation_video_call'),
    Icon: VideoCallIcon,
    onClick: () => {
      startCall(conversationId, true)
      openConversation()
    },
  },
  {
    label: translate('conversation_open_new_tab'),
    Icon: OpenInNewIcon,
    dividerBefore: true,
    onClick: openInNewTab,
  },
  {
    label: isMuted ? translate('unmute_conversation') : translate('mute_conversation'),
    Icon: isMuted ? NotificationsActiveIcon : NotificationsOffIcon,
    disabled: !isMutePreferenceReady,
    onClick: toggleMute,
  },
  ...(hasUnreadMessages
    ? [
        {
          label: translate('conversation_mark_as_read'),
          Icon: MarkChatReadIcon,
          onClick: markConversationRead,
        },
      ]
    : []),
  {
    label: translate(conversationMemberUri ? 'conversation_contact_info' : 'conversation_group_info'),
    Icon: PersonIcon,
    onClick: openContactInfo,
  },
  {
    label: translate('leave_conversation'),
    Icon: ExitToAppIcon,
    dividerBefore: true,
    destructive: true,
    onClick: leaveConversation,
  },
  ...(conversationMemberUri
    ? [
        {
          label: translate('conversation_block_action'),
          Icon: BlockContactIcon,
          destructive: true,
          onClick: blockConversation,
        },
      ]
    : []),
]

const ConversationMenu = ({
  conversationMemberUri,
  conversationId,
  conversationName,
  lastMessageId,
  hasUnreadMessages,
  isSelected,
  contextMenuProps,
  conversationAvatar,
}: ConversationMenuProps) => {
  const { t } = useTranslation()
  const { account } = useAuthContext()
  const { startCall } = useCallManagerContext()
  const navigate = useNavigate()
  const webSocket = useWebSocketContext()
  const contactDetailsDialogHandler = useDialogHandler()
  const conversationDetailsDialogHandler = useDialogHandler()
  const removeConversationDialogHandler = useDialogHandler()
  const blockDialogHandler = useDialogHandler()
  const preferencesQuery = useConversationPreferencesQuery(conversationId, contextMenuProps.open)
  const preferencesMutation = useConversationPreferencesMutation(conversationId)
  const markConversationSummaryRead = useMarkConversationSummaryRead()
  const contactQuery = useContactQuery(conversationMemberUri, contactDetailsDialogHandler.props.open)
  const blockContactMutation = useBlockContactMutation()
  const isMuted = preferencesQuery.data?.ignoreNotifications ?? false
  const isMutePreferenceReady = preferencesQuery.isSuccess && preferencesQuery.data !== undefined
  const isSwarm = !conversationMemberUri

  const toggleMute = useCallback(() => {
    preferencesMutation.mutate({ ignoreNotifications: !isMuted })
  }, [isMuted, preferencesMutation])

  const markConversationRead = useCallback(() => {
    if (!lastMessageId) {
      return
    }

    markConversationSummaryRead(conversationId)
    webSocket.send(WebSocketMessageType.AccountMessageStatus, {
      conversationId,
      messageId: lastMessageId,
      peer: account.getUri(),
      status: MessageStatusCode.read,
    })
  }, [account, conversationId, lastMessageId, markConversationSummaryRead, webSocket])

  const openInNewTab = useCallback(() => {
    window.open(`/conversation/${conversationId}`, '_blank', 'noopener,noreferrer')
  }, [conversationId])

  const openConversation = useCallback(() => {
    navigate(`/conversation/${conversationId}`)
  }, [conversationId, navigate])

  const blockContact = useCallback(() => {
    if (!conversationMemberUri) {
      return
    }

    blockContactMutation.mutate(conversationMemberUri, {
      onSettled: blockDialogHandler.props.onClose,
    })
  }, [blockContactMutation, blockDialogHandler.props.onClose, conversationMemberUri])

  const menuOptions = useMemo(
    () =>
      createConversationMenuOptions({
        conversationId,
        conversationMemberUri,
        isMuted,
        hasUnreadMessages,
        isMutePreferenceReady,
        translate: t,
        startCall,
        openConversation,
        openInNewTab,
        toggleMute,
        markConversationRead,
        openContactInfo: conversationMemberUri
          ? contactDetailsDialogHandler.openDialog
          : conversationDetailsDialogHandler.openDialog,
        leaveConversation: removeConversationDialogHandler.openDialog,
        blockConversation: blockDialogHandler.openDialog,
      }),
    [
      blockDialogHandler.openDialog,
      conversationDetailsDialogHandler.openDialog,
      conversationId,
      conversationMemberUri,
      hasUnreadMessages,
      contactDetailsDialogHandler.openDialog,
      isMuted,
      isMutePreferenceReady,
      markConversationRead,
      openConversation,
      openInNewTab,
      removeConversationDialogHandler.openDialog,
      startCall,
      t,
      toggleMute,
    ],
  )

  return (
    <>
      <ContextMenu {...contextMenuProps} items={menuOptions} />

      {conversationMemberUri ? (
        <ContactDetailDialog contactDetail={contactQuery.data} {...contactDetailsDialogHandler.props} />
      ) : (
        <DetailsDialog
          {...conversationDetailsDialogHandler.props}
          conversationId={conversationId}
          conversationName={conversationName}
          conversationAvatar={conversationAvatar}
          conversationMemberUri={conversationMemberUri}
          isSwarm={isSwarm}
        />
      )}

      <RemoveConversationDialog
        {...removeConversationDialogHandler.props}
        conversationId={conversationId}
        isCurrent={isSelected}
      />
      <ConfirmationDialog
        {...blockDialogHandler.props}
        title={t('dialog_confirm_title_default')}
        content={t('contact_ask_confirm_block')}
        onConfirm={blockContact}
        confirmButtonText={t('contact_confirm_block')}
      />
    </>
  )
}

interface DetailsDialogProps {
  conversationId: string
  conversationName: string
  open: boolean
  onClose: () => void
  isSwarm: boolean
  conversationAvatar?: string
  conversationMemberUri?: string
}

const DetailsDialog = ({
  conversationId,
  conversationName,
  open,
  onClose,
  isSwarm,
  conversationAvatar,
  conversationMemberUri,
}: DetailsDialogProps) => {
  const { t } = useTranslation()
  const items = useMemo(
    () => [
      {
        label: t('conversation_details_name'),
        value: conversationName,
      },
      {
        label: t('conversation_details_identifier'),
        value: conversationId,
      },
      {
        label: t('conversation_details_qr_code'),
        value: <JamiQrCode size={80} value={`${conversationId}`} />,
      },
      {
        label: t('conversation_details_is_swarm'),
        value: isSwarm ? t('conversation_details_is_swarm_true') : t('conversation_details_is_swarm_false'),
      },
    ],
    [conversationId, conversationName, isSwarm, t],
  )
  return (
    <InfosDialog
      open={open}
      onClose={onClose}
      icon={
        <ConversationAvatar
          src={conversationAvatar}
          contactUri={conversationMemberUri || ''}
          sx={{ width: 'inherit', height: 'inherit' }}
          color={getColor(conversationId)}
          displayName={conversationName}
        />
      }
      title={conversationName}
      content={<DialogContentList title={t('conversation_details_information')} items={items} />}
    />
  )
}
