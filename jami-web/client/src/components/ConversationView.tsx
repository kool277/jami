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
import { InputBase, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { alpha, darken, lighten } from '@mui/material/styles'
import { lazy, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { useCallManagerContext } from '../contexts/CallManagerProvider.js'
import ConversationPreferencesColorProvider, {
  useConversationPreferencesColorContext,
} from '../contexts/ConversationPreferencesColorContext.js'
import ConversationPreferencesNotificationsProvider from '../contexts/ConversationPreferencesNotificationsContext.js'
import ConversationPreferencesStateProvider, {
  useConversationPreferencesStateContext,
} from '../contexts/ConversationPreferencesStateContext.js'
import { useConversationContext } from '../contexts/ConversationProvider.js'
import { useContactQuery } from '../services/contactQueries.js'
import { useStartConversationMutation } from '../services/pendingConversationQueries.js'
//import CallInterface from '../pages/CallInterface.js'
const CallInterface = lazy(() => import('../pages/CallInterface.js'))
import ChatInterface from '../pages/ChatInterface.js'
import BaseIconButton from './common/BaseIconButton.js'
import Island, { ISLAND_MARGIN } from './common/Island.js'
import ConversationAvatar, { GroupConversationAvatar } from './ConversationAvatar.js'
import ConversationPreferences from './ConversationPreferences.js'
import { ArrowBackIosNewIcon, JamiIdIcon } from './SvgIcon.js'
import { AudioCallIcon, ListIcon, SearchRoundedIcon, VideoCallIcon } from './SvgIcon.js'

export function getConversationHeaderIdentity(displayName: string, registeredName?: string, hash?: string) {
  const jamiId = registeredName || hash

  if (!jamiId || displayName !== jamiId) {
    return { primary: displayName, secondary: jamiId }
  }

  return { primary: jamiId, primaryIsJamiId: true }
}

export function getConversationHeaderSecondary(isGroup: boolean, description: string | undefined, identity?: string) {
  return isGroup ? description?.trim() || undefined : identity
}

const ConversationView = () => {
  const { conversationId } = useConversationContext()
  const { callData } = useCallManagerContext()

  if (callData?.conversationId === conversationId) {
    return <CallInterface />
  }

  return (
    <ConversationPreferencesStateProvider>
      <ConversationPreferencesNotificationsProvider>
        <ConversationPreferencesColorProvider>
          <ConversationContent />
        </ConversationPreferencesColorProvider>
      </ConversationPreferencesNotificationsProvider>
    </ConversationPreferencesStateProvider>
  )
}

const ConversationContent = () => {
  const { conversationColor } = useConversationPreferencesColorContext()
  const { isOpen } = useConversationPreferencesStateContext()
  const theme = useTheme()
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const isMedium: boolean = useMediaQuery(theme.breakpoints.only('sm'))
  // The conversation colour washes the chat pane rather than the whole window, so
  // the pane stays identifiable without tinting the rest of the shell.
  const background = conversationColor
    ? theme.palette.mode === 'dark'
      ? darken(conversationColor, 0.85)
      : lighten(conversationColor, 0.85)
    : 'background.default'

  return (
    <Stack direction="row" sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <Stack
        sx={{
          flex: isOpen && (isMobile || isMedium) ? '0 1 0px' : 1,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Island
          sx={{
            flex: 1,
            m: ISLAND_MARGIN,
            ml: 0,
            position: 'relative',
            backgroundColor: background,
            transition: 'background-color 0.6s ease-in-out',
          }}
        >
          <ChatInterface />
        </Island>
      </Stack>
      <ConversationPreferences />
    </Stack>
  )
}

export const ConversationHeader = () => {
  const { t } = useTranslation()
  const { conversationDisplayName, conversationId, conversationInfos, members, isPending, pendingContact } =
    useConversationContext()
  const { account } = useAuthContext()
  const { startCall } = useCallManagerContext()
  const { isOpen, setIsOpen, isSearchOpen, setIsSearchOpen, setSearchQuery } = useConversationPreferencesStateContext()
  const theme = useTheme()
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const startConversationMutation = useStartConversationMutation()
  const navigate = useNavigate()

  // Calling a peer that has not been invited yet invites them first, so the call
  // has a swarm to ring in.
  const startConversationCall = useCallback(
    (withVideoOn: boolean) => {
      if (!isPending) {
        startCall(conversationId, withVideoOn)
        return
      }
      if (!pendingContact) {
        return
      }

      startConversationMutation.mutate(
        { contactUri: pendingContact.uri },
        {
          onSuccess: (newConversationId) => {
            navigate(`/conversation/${newConversationId}`, { replace: true })
            startCall(newConversationId, withVideoOn)
          },
        },
      )
    },
    [conversationId, isPending, navigate, pendingContact, startCall, startConversationMutation],
  )

  // `members` includes the local account, so a one-to-one conversation has two
  // entries: resolve the contact from the peers rather than the total count.
  const otherMembers = useMemo(
    () => members?.filter((m) => m.contact.uri !== account.getUri()) ?? [],
    [members, account],
  )
  const otherMember = otherMembers[0]
  const isGroup = Number(conversationInfos.mode) !== 0
  const avatarUri = otherMember?.contact.uri
  const contactUri = otherMembers.length === 1 ? avatarUri : undefined
  // A pending peer is not a contact yet, so there are no contact details to fetch.
  const contactQuery = useContactQuery(isPending ? undefined : contactUri)
  const displayName = contactQuery.data?.displayName || conversationDisplayName
  const { primary, secondary, primaryIsJamiId } = getConversationHeaderIdentity(
    displayName,
    contactUri ? otherMember?.contact.registeredName : undefined,
    contactUri,
  )
  const headerSecondary = getConversationHeaderSecondary(isGroup, conversationInfos.description, secondary)

  const handleSearchClose = () => {
    setIsSearchOpen(false)
    setSearchQuery('')
  }

  return (
    <Stack
      direction="row"
      sx={{
        padding: '4px 6px 4px 4px',
        overflow: 'hidden',
        alignItems: 'center',
        position: 'absolute',
        top: 8,
        left: 12,
        right: 12,
        zIndex: 20,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        backgroundColor: alpha(theme.palette.background.default, 0.82),
        boxShadow: theme.shadows[3],
        borderRadius: '9999px',
        maxWidth: '600px',
        mx: 'auto',
      }}
    >
      {isSearchOpen ? (
        <>
          <BaseIconButton
            aria-label={t('conversation_search_close')}
            tooltip={t('conversation_search_close')}
            onClick={handleSearchClose}
            sx={{ flexShrink: 0 }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
          </BaseIconButton>
          <InputBase
            autoFocus
            inputProps={{ 'aria-label': t('conversation_search') }}
            placeholder={t('conversation_search')}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ flex: 1 }}
          />
        </>
      ) : (
        <>
          <Stack
            direction="row"
            spacing="12px"
            sx={{
              flex: 1,
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {isGroup ? (
              <GroupConversationAvatar
                displayName={conversationDisplayName}
                members={members}
                src={conversationInfos.avatar}
                sx={{ width: 40, height: 40, flexShrink: 0 }}
              />
            ) : (
              avatarUri && (
                <ConversationAvatar
                  displayName={displayName}
                  contactUri={avatarUri}
                  presence={true}
                  sx={{ width: 40, height: 40, fontSize: '1rem' }}
                />
              )
            )}
            <Stack
              sx={{
                overflow: 'hidden',
                justifyContent: 'center',
              }}
            >
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                {primaryIsJamiId && <JamiIdIcon aria-hidden="true" size={16} sx={{ flexShrink: 0 }} />}
                <Typography
                  noWrap
                  variant="body1"
                  sx={{
                    textOverflow: 'ellipsis',
                    maxWidth: isMobile ? '120px' : '400px',
                  }}
                >
                  {primary}
                </Typography>
              </Stack>
              {headerSecondary && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
                  {!isGroup && (
                    <JamiIdIcon
                      aria-hidden="true"
                      size={16}
                      sx={{ flexShrink: 0, color: theme.palette.text.secondary }}
                    />
                  )}
                  <Typography
                    noWrap
                    variant="caption"
                    sx={{
                      textOverflow: 'ellipsis',
                      color: theme.palette.text.secondary,
                      maxWidth: isMobile ? '120px' : '400px',
                    }}
                  >
                    {headerSecondary}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Stack>
          <Stack
            direction="row"
            spacing="12px"
            sx={{
              alignItems: 'center',
            }}
          >
            <BaseIconButton
              aria-label={t('conversation_start_audiocall')}
              tooltip={t('conversation_start_audiocall')}
              onClick={() => startConversationCall(false)}
            >
              <AudioCallIcon />
            </BaseIconButton>
            <BaseIconButton
              aria-label={t('conversation_start_videocall')}
              tooltip={t('conversation_start_videocall')}
              onClick={() => startConversationCall(true)}
            >
              <VideoCallIcon />
            </BaseIconButton>
            {!isPending && (
              <>
                <BaseIconButton
                  aria-label={t('conversation_search')}
                  tooltip={t('conversation_search')}
                  onClick={() => setIsSearchOpen(true)}
                >
                  <SearchRoundedIcon sx={{ fontSize: 22 }} />
                </BaseIconButton>
                <BaseIconButton
                  aria-label={t('conversation_show_options')}
                  aria-pressed={isOpen}
                  tooltip={t('conversation_show_options')}
                  onClick={() => setIsOpen(!isOpen)}
                  sx={{ backgroundColor: isOpen ? 'action.selected' : 'transparent' }}
                >
                  <ListIcon />
                </BaseIconButton>
              </>
            )}
          </Stack>
        </>
      )}
    </Stack>
  )
}

export default ConversationView
