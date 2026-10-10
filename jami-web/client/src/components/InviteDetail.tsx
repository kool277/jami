/*
 * Copyright (C) 2026 Savoir-faire Linux Inc.
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
import { keyframes } from '@emotion/react'
import { Box, Stack, Typography } from '@mui/material'
import { IConversationRequest } from '@savoirfairelinux/jami-web-common'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { Contact } from '../models/contact.js'
import {
  useAcceptConversationRequestMutation,
  useBlockConversationRequestMutation,
  useConversationRequestsQuery,
  useDeclineConversationRequestMutation,
} from '../services/conversationQueries.js'
import { formatConversationDate, formatRelativeDate, formatTime } from '../utils/dates&times.js'
import BaseIconButton from './common/BaseIconButton.js'
import EmptyState from './common/EmptyState.js'
import FilledIconButton from './common/FilledIconButton.js'
import InviteDetailSkeleton from './common/InviteDetailSkeleton.js'
import Island, { ISLAND_MARGIN, ISLAND_PADDING } from './common/Island.js'
import { isJamiHash } from './ContactIdentity.js'
import ConversationAvatar from './ConversationAvatar.js'
import LoadingPage from './Loading.js'
import {
  AccountCircleIcon,
  CheckMarkIcon,
  GroupsIcon,
  JamiIdIcon,
  PersonWithCrossMarkIcon,
  SaltireIcon,
} from './SvgIcon.js'

const IDENTITY_ANIMATION_DURATION = 200
const concealFromRight = keyframes`
  from {
    clip-path: inset(0);
  }
  to {
    clip-path: inset(0 100% 0 0);
  }
`
const revealFromLeft = keyframes`
  from {
    clip-path: inset(0 100% 0 0);
  }
  to {
    clip-path: inset(0);
  }
`
const revealAvatar = keyframes`
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`
const concealAvatar = keyframes`
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
  }
`
const summaryLayoutTransition = { duration: IDENTITY_ANIMATION_DURATION / 1000, ease: 'easeOut' } as const

function AnimatedSummaryItem({ children }: { children: ReactNode }) {
  return (
    <motion.div
      layout="position"
      transition={summaryLayoutTransition}
      style={{ display: 'flex', width: '100%', justifyContent: 'center' }}
    >
      {children}
    </motion.div>
  )
}

type InviteAvatar = {
  avatar?: string
  identity: string
  title?: string
}

function AnimatedInviteAvatar({
  avatar,
  conversationId,
  title,
}: {
  avatar?: string
  conversationId: string
  title?: string
}) {
  const identity = `${conversationId}:${avatar ?? ''}:${title ?? ''}`
  const currentAvatarRef = useRef<InviteAvatar>({ avatar, identity, title })
  const [previousAvatar, setPreviousAvatar] = useState<InviteAvatar>()

  useEffect(() => {
    if (currentAvatarRef.current.identity === identity) {
      return
    }

    const previous = currentAvatarRef.current
    currentAvatarRef.current = { avatar, identity, title }
    setPreviousAvatar(previous)
    const timer = window.setTimeout(() => setPreviousAvatar(undefined), IDENTITY_ANIMATION_DURATION)

    return () => window.clearTimeout(timer)
  }, [avatar, identity, title])

  return (
    <Box data-testid="invite-avatar-transition" sx={{ position: 'relative', width: '200px', height: '200px' }}>
      {previousAvatar && (
        <Box
          data-testid="invite-previous-avatar"
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            animation: `${concealAvatar} ${IDENTITY_ANIMATION_DURATION}ms ease-in both`,
          }}
        >
          <ConversationAvatar
            displayName={previousAvatar.title || ''}
            src={previousAvatar.avatar}
            sx={{ width: '200px', height: '200px' }}
            contactUri=""
          />
        </Box>
      )}
      <Box
        key={identity}
        sx={{
          position: 'relative',
          zIndex: 1,
          animation: `${revealAvatar} ${IDENTITY_ANIMATION_DURATION}ms ease-out both`,
        }}
      >
        <ConversationAvatar
          displayName={title || ''}
          src={avatar}
          sx={{ width: '200px', height: '200px' }}
          contactUri=""
        />
      </Box>
    </Box>
  )
}

export default function InviteDetail() {
  const { t } = useTranslation()
  const { conversationId } = useParams()
  const conversationRequestsQuery = useConversationRequestsQuery()
  const conversationRequest = conversationRequestsQuery.data?.find(
    (request) => request.conversationId === conversationId,
  )

  if (conversationRequestsQuery.isPending) {
    return <InviteDetailSkeleton />
  }

  if (!conversationRequest) {
    return <EmptyState title={t('invitations_select')} />
  }

  return <InviteDetailContent conversationRequest={conversationRequest} />
}

function InviteDetailContent({ conversationRequest }: { conversationRequest: IConversationRequest }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [isSenderHashVisible, setIsSenderHashVisible] = useState(false)
  const [hasToggledSenderIdentity, setHasToggledSenderIdentity] = useState(false)
  const [identitySlotWidth, setIdentitySlotWidth] = useState<number>()
  const identitySlotWidthRef = useRef<number | undefined>(undefined)
  const identityKeyRef = useRef<string | undefined>(undefined)
  const expansionTimerRef = useRef<number | undefined>(undefined)
  const nameRef = useRef<HTMLSpanElement>(null)
  const hashRef = useRef<HTMLSpanElement>(null)
  const {
    conversationId,
    infos: { avatar, description, mode, title },
    membersNames,
    received,
  } = conversationRequest

  const contact = useMemo(
    () => new Contact(conversationRequest.from.uri, conversationRequest.from.registeredName),
    [conversationRequest],
  )
  const isGroupInvitation = mode !== undefined && Number(mode) !== 0
  const preferredSenderName = isGroupInvitation ? membersNames[0] : title || membersNames[0]
  const senderName =
    preferredSenderName && preferredSenderName !== contact.uri
      ? preferredSenderName
      : contact.getDisplayNameNoFallback()
  const senderIdentity = senderName || contact.uri
  const receivedAt = /^\d+(?:\.\d+)?$/.test(received) ? dayjs.unix(Number(received)) : dayjs(received)
  const receivedDate = formatConversationDate(receivedAt, i18n)
  const receivedTime = formatTime(receivedAt, i18n)
  const receivedDateTime = receivedAt.isToday()
    ? `${formatRelativeDate(receivedAt, i18n)}, ${receivedTime}`
    : `${receivedDate}, ${receivedTime}`
  const invitationText = t(
    isGroupInvitation ? 'conversation_request_has_sent_group_request' : 'conversation_request_has_sent_request',
    { contact: senderIdentity },
  )
    .replace(senderIdentity, `${senderIdentity}\n`)
    .replace(/\n\s*/, '\n')
  const [invitationPrefix, invitationSuffix] = invitationText.split(senderIdentity)
  const identityKey = `${conversationId}:${senderIdentity}:${contact.uri}`
  const getIdentityWidth = (isHashVisible: boolean) =>
    (isHashVisible ? hashRef : nameRef).current?.getBoundingClientRect().width ?? 0

  useLayoutEffect(() => {
    if (identityKeyRef.current !== identityKey) {
      if (expansionTimerRef.current !== undefined) {
        window.clearTimeout(expansionTimerRef.current)
        expansionTimerRef.current = undefined
      }

      identityKeyRef.current = identityKey
      const initialWidth = getIdentityWidth(false)
      identitySlotWidthRef.current = initialWidth || undefined
      setIdentitySlotWidth(initialWidth || undefined)
      setIsSenderHashVisible(false)
      setHasToggledSenderIdentity(false)
      return
    }

    const initialWidth = getIdentityWidth(isSenderHashVisible)

    if (initialWidth > 0 && identitySlotWidthRef.current === undefined) {
      identitySlotWidthRef.current = initialWidth
      setIdentitySlotWidth(initialWidth)
    }
  }, [identityKey, isSenderHashVisible])

  useEffect(
    () => () => {
      if (expansionTimerRef.current !== undefined) {
        window.clearTimeout(expansionTimerRef.current)
      }
    },
    [],
  )

  const toggleSenderIdentity = () => {
    const nextIsSenderHashVisible = !isSenderHashVisible
    const nextWidth = getIdentityWidth(nextIsSenderHashVisible)

    if (expansionTimerRef.current !== undefined) {
      window.clearTimeout(expansionTimerRef.current)
      expansionTimerRef.current = undefined
    }

    setHasToggledSenderIdentity(true)
    setIsSenderHashVisible(nextIsSenderHashVisible)

    if (nextWidth > 0 && nextWidth !== identitySlotWidthRef.current) {
      expansionTimerRef.current = window.setTimeout(() => {
        identitySlotWidthRef.current = nextWidth
        setIdentitySlotWidth(nextWidth)
        expansionTimerRef.current = undefined
      }, IDENTITY_ANIMATION_DURATION)
    }
  }
  const conceal = (delay = 0) => `${concealFromRight} ${IDENTITY_ANIMATION_DURATION}ms ease-in ${delay}ms forwards`
  const reveal = (delay = 0) => `${revealFromLeft} ${IDENTITY_ANIMATION_DURATION}ms ease-out ${delay}ms both`
  const nameAnimation = hasToggledSenderIdentity
    ? isSenderHashVisible
      ? conceal()
      : reveal(IDENTITY_ANIMATION_DURATION * 3)
    : undefined
  const accountIconAnimation = hasToggledSenderIdentity
    ? isSenderHashVisible
      ? conceal(IDENTITY_ANIMATION_DURATION)
      : reveal(IDENTITY_ANIMATION_DURATION * 2)
    : undefined
  const jamiIdIconAnimation = hasToggledSenderIdentity
    ? isSenderHashVisible
      ? reveal(IDENTITY_ANIMATION_DURATION * 2)
      : conceal(IDENTITY_ANIMATION_DURATION)
    : undefined
  const hashAnimation = hasToggledSenderIdentity
    ? isSenderHashVisible
      ? reveal(IDENTITY_ANIMATION_DURATION * 3)
      : conceal()
    : undefined
  const senderIdentityText = senderName ? (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <Box
        component="span"
        data-testid="invite-sender-id-container"
        sx={{ display: 'inline-flex', alignItems: 'center', width: 24, height: 24, lineHeight: 0 }}
      >
        <BaseIconButton
          data-testid="invite-sender-id-icon"
          aria-label={contact.uri}
          aria-pressed={isSenderHashVisible}
          tooltip={contact.uri}
          onClick={toggleSenderIdentity}
          size="small"
          sx={{ p: 0, width: 24, height: 24, flexShrink: 0, color: 'text.primary' }}
        >
          <Box
            component="span"
            sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: 24, height: 24 }}
          >
            <Box
              component="span"
              data-testid="invite-sender-account-icon"
              sx={{
                position: isSenderHashVisible ? 'absolute' : 'static',
                left: isSenderHashVisible ? 0 : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                width: 24,
                height: 24,
                clipPath: hasToggledSenderIdentity ? undefined : 'inset(0)',
                animation: accountIconAnimation,
              }}
            >
              <AccountCircleIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box
              component="span"
              data-testid="invite-sender-jami-id-icon"
              sx={{
                position: isSenderHashVisible ? 'static' : 'absolute',
                left: isSenderHashVisible ? undefined : 0,
                display: 'inline-flex',
                alignItems: 'center',
                width: 24,
                height: 24,
                clipPath: hasToggledSenderIdentity ? undefined : 'inset(0 100% 0 0)',
                pointerEvents: 'none',
                animation: jamiIdIconAnimation,
              }}
            >
              <JamiIdIcon sx={{ width: 24, height: 24 }} />
            </Box>
          </Box>
        </BaseIconButton>
      </Box>
      <Box
        component="span"
        data-testid="invite-sender-identity-label"
        sx={{
          position: 'relative',
          display: 'inline-block',
          width: identitySlotWidth,
          transition: `width ${IDENTITY_ANIMATION_DURATION}ms ease-out`,
        }}
      >
        <Box
          component="span"
          ref={nameRef}
          data-testid="invite-sender-name"
          sx={{
            position: isSenderHashVisible ? 'absolute' : 'static',
            left: isSenderHashVisible ? 0 : undefined,
            whiteSpace: 'nowrap',
            clipPath: hasToggledSenderIdentity ? undefined : 'inset(0)',
            animation: nameAnimation,
          }}
        >
          {senderName}
        </Box>
        <Box
          component="span"
          ref={hashRef}
          data-testid="invite-sender-hash"
          sx={{
            position: isSenderHashVisible ? 'static' : 'absolute',
            left: isSenderHashVisible ? undefined : 0,
            whiteSpace: 'nowrap',
            clipPath: hasToggledSenderIdentity ? undefined : 'inset(0 100% 0 0)',
            pointerEvents: 'none',
            userSelect: 'none',
            fontFamily: isJamiHash(contact.uri) ? 'monospace' : undefined,
            animation: hashAnimation,
          }}
        >
          {contact.uri}
        </Box>
      </Box>
    </Box>
  ) : (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <JamiIdIcon data-testid="invite-sender-jami-id-icon" sx={{ width: 24, height: 24 }} />
      <Box component="span" sx={{ fontFamily: isJamiHash(contact.uri) ? 'monospace' : undefined }}>
        {contact.uri}
      </Box>
    </Box>
  )
  const blockConversationRequestMutation = useBlockConversationRequestMutation()
  const acceptConversationRequestMutation = useAcceptConversationRequestMutation()
  const declineConversationRequestMutation = useDeclineConversationRequestMutation()
  const returnToInvites = useCallback(() => navigate('/invites'), [navigate])

  const blockConversationRequest = useCallback(() => {
    blockConversationRequestMutation.mutate(
      { conversationId },
      {
        onSettled: returnToInvites,
      },
    )
  }, [blockConversationRequestMutation, conversationId, returnToInvites])

  const acceptConversationRequest = useCallback(() => {
    acceptConversationRequestMutation.mutate(
      { conversationId },
      {
        onSuccess: () => navigate(`/conversation/${conversationId}`),
      },
    )
  }, [acceptConversationRequestMutation, conversationId, navigate])

  const declineConversationRequest = useCallback(() => {
    declineConversationRequestMutation.mutate(
      { conversationId },
      {
        onSettled: returnToInvites,
      },
    )
  }, [conversationId, declineConversationRequestMutation, returnToInvites])

  return (
    <Island
      component="section"
      aria-label={t('invitations')}
      spacing="40px"
      sx={{
        flex: 1,
        m: ISLAND_MARGIN,
        ml: 0,
        p: `${ISLAND_PADDING} 0px 0px ${ISLAND_PADDING}`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Stack data-testid="invite-summary" spacing="8px" sx={{ alignItems: 'center' }}>
        <AnimatedSummaryItem>
          <AnimatedInviteAvatar avatar={avatar} conversationId={conversationId} title={title} />
        </AnimatedSummaryItem>
        {!acceptConversationRequestMutation.isPending && isGroupInvitation && title && (
          <AnimatedSummaryItem>
            <Stack direction="row" spacing="4px" sx={{ alignItems: 'center', marginBottom: '-4px' }}>
              <GroupsIcon data-testid="invite-group-icon" sx={{ fontSize: 24 }} />
              <Typography component="h2" data-testid="invite-group-title" variant="h3" sx={{ m: 0 }}>
                {title}
              </Typography>
            </Stack>
          </AnimatedSummaryItem>
        )}
        {!acceptConversationRequestMutation.isPending && description && (
          <AnimatedSummaryItem>
            <Box sx={{ paddingBottom: isGroupInvitation ? '16px' : 0 }}>
              <Typography
                component="pre"
                data-testid="invite-description"
                variant="h4"
                sx={{ m: 0, color: 'text.secondary', fontWeight: 500 }}
              >
                {description}
              </Typography>
            </Box>
          </AnimatedSummaryItem>
        )}
        {!acceptConversationRequestMutation.isPending && (
          <>
            <AnimatedSummaryItem>
              <Typography
                variant="h4"
                sx={{
                  whiteSpace: 'pre-line',
                  textAlign: 'center',
                  fontWeight: 'normal',
                }}
              >
                {invitationPrefix}
                {senderIdentityText}
                {invitationSuffix}
              </Typography>
            </AnimatedSummaryItem>
            <AnimatedSummaryItem>
              <Typography
                component="time"
                data-testid="invite-received"
                dateTime={received}
                title={received}
                variant="caption"
                sx={{ m: 0, color: 'text.secondary' }}
              >
                {receivedDateTime}
              </Typography>
            </AnimatedSummaryItem>
          </>
        )}
      </Stack>
      {acceptConversationRequestMutation.isPending ? (
        <>
          <Typography
            variant="h3"
            sx={{
              whiteSpace: 'pre-line',
              textAlign: 'center',
              fontWeight: 'bold',
            }}
          >
            {t('conversation_request_accepted')}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              whiteSpace: 'pre-line',
              textAlign: 'center',
            }}
          >
            {t('conversation_request_waiting_for_sync', { contact: senderIdentity })}
          </Typography>
          <LoadingPage />
        </>
      ) : (
        <>
          <Stack direction="row" spacing="30px">
            <FilledIconButton
              aria-label={t('conversation_request_block')}
              tooltip={t('conversation_request_block')}
              onClick={blockConversationRequest}
              paletteColor={(theme) => theme.palette.warning}
            >
              <PersonWithCrossMarkIcon fontSize="inherit" />
            </FilledIconButton>
            <FilledIconButton
              aria-label={t('conversation_request_decline')}
              tooltip={t('conversation_request_decline')}
              onClick={declineConversationRequest}
              paletteColor={(theme) => theme.palette.error}
            >
              <SaltireIcon fontSize="inherit" />
            </FilledIconButton>
            <FilledIconButton
              aria-label={t('conversation_request_accept')}
              tooltip={t('conversation_request_accept')}
              onClick={acceptConversationRequest}
              paletteColor={(theme) => theme.palette.success}
            >
              <CheckMarkIcon fontSize="inherit" />
            </FilledIconButton>
          </Stack>
        </>
      )}
    </Island>
  )
}
