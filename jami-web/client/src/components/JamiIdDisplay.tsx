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

import { alpha, Box, keyframes, Typography, useTheme } from '@mui/material'
import { use, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { Account } from '../models/account.js'
import BaseIconButton from './common/BaseIconButton.js'
import QrCodeModal from './QrCodeModal.js'
import { ContentCopyIcon, FingerprintIcon, JamiIdIcon, QrCodeIcon } from './SvgIcon.js'

type JamiIdDisplayProps = {
  account: Account
}

const IDENTITY_ANIMATION_DURATION = 300
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

export default function JamiIdDisplay({ account }: JamiIdDisplayProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const { setAlertContent } = use(AlertSnackbarContext)
  const hash = account.getUri()
  const registeredName = account.getRegisteredName()
  const [isHashVisible, setIsHashVisible] = useState(false)
  const [hasToggledIdentity, setHasToggledIdentity] = useState(false)
  const [identitySlotWidth, setIdentitySlotWidth] = useState<number>()
  const [isQrCodeModalOpen, setIsQrCodeModalOpen] = useState(false)
  const identityKey = `${registeredName}:${hash}`
  const identityKeyRef = useRef<string | undefined>(undefined)
  const identitySlotWidthRef = useRef<number | undefined>(undefined)
  const expansionTimerRef = useRef<number | undefined>(undefined)
  const nameRef = useRef<HTMLSpanElement>(null)
  const hashRef = useRef<HTMLSpanElement>(null)
  const jamiId = isHashVisible || !registeredName ? hash : registeredName
  const getIdentityWidth = (isHashVisible: boolean) => {
    const identity = (isHashVisible ? hashRef : nameRef).current

    // The settings page enters at scale 0.9, so a bounding rect would permanently capture a
    // narrower width. scrollWidth describes the text's untransformed intrinsic width.
    return identity?.scrollWidth || identity?.getBoundingClientRect().width || 0
  }
  const conceal = (delay = 0) => `${concealFromRight} ${IDENTITY_ANIMATION_DURATION}ms ease-in ${delay}ms forwards`
  const reveal = (delay = 0) => `${revealFromLeft} ${IDENTITY_ANIMATION_DURATION}ms ease-out ${delay}ms both`
  const nameAnimation = hasToggledIdentity
    ? isHashVisible
      ? conceal()
      : reveal(IDENTITY_ANIMATION_DURATION)
    : undefined
  const hashAnimation = hasToggledIdentity
    ? isHashVisible
      ? reveal(IDENTITY_ANIMATION_DURATION)
      : conceal()
    : undefined

  useLayoutEffect(() => {
    if (!registeredName) {
      return
    }

    if (identityKeyRef.current !== identityKey) {
      if (expansionTimerRef.current !== undefined) {
        window.clearTimeout(expansionTimerRef.current)
        expansionTimerRef.current = undefined
      }

      identityKeyRef.current = identityKey
      const initialWidth = getIdentityWidth(false)
      identitySlotWidthRef.current = initialWidth || undefined
      setIdentitySlotWidth(initialWidth || undefined)
      setIsHashVisible(false)
      setHasToggledIdentity(false)
      return
    }

    const initialWidth = getIdentityWidth(isHashVisible)
    if (initialWidth > 0 && identitySlotWidthRef.current === undefined) {
      identitySlotWidthRef.current = initialWidth
      setIdentitySlotWidth(initialWidth)
    }
  }, [identityKey, isHashVisible, registeredName])

  useEffect(
    () => () => {
      if (expansionTimerRef.current !== undefined) {
        window.clearTimeout(expansionTimerRef.current)
      }
    },
    [],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jamiId)
      setAlertContent({
        messageI18nKey: 'copied_to_clipboard',
        severity: 'success',
        alertOpen: true,
      })
    } catch {
      setAlertContent({
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
        alertOpen: true,
      })
    }
  }

  return (
    <Box
      sx={{
        backgroundColor: alpha(theme.palette.text.primary, 0.06),
        border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
        borderRadius: 3,
        display: 'flex',
        gap: 1,
        alignItems: 'center',
        maxWidth: '100%',
        pl: '8px',
        pr: '4px',
        pt: '4px',
        pb: '4px',
        width: 'fit-content',
      }}
    >
      <JamiIdIcon sx={{ flexShrink: 0 }} />
      {registeredName ? (
        <Typography
          data-testid="jami-id-display-text"
          noWrap
          sx={{
            alignItems: 'center',
            alignSelf: 'stretch',
            display: 'flex',
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            component="span"
            data-testid="jami-id-display-identity"
            sx={{
              display: 'inline-block',
              position: 'relative',
              width: identitySlotWidth,
              maxWidth: '100%',
              overflow: 'hidden',
              transition: `width ${IDENTITY_ANIMATION_DURATION}ms ease-out`,
            }}
          >
            <Box
              component="span"
              ref={nameRef}
              data-testid="jami-id-display-name"
              aria-hidden={isHashVisible}
              sx={{
                display: 'inline-block',
                position: isHashVisible ? 'absolute' : 'static',
                left: isHashVisible ? 0 : undefined,
                whiteSpace: 'nowrap',
                clipPath: hasToggledIdentity ? undefined : 'inset(0)',
                animation: nameAnimation,
              }}
            >
              {registeredName}
            </Box>
            <Box
              component="span"
              ref={hashRef}
              data-testid="jami-id-display-hash"
              aria-hidden={!isHashVisible}
              sx={{
                display: 'inline-block',
                position: isHashVisible ? 'static' : 'absolute',
                left: isHashVisible ? undefined : 0,
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                clipPath: hasToggledIdentity ? undefined : 'inset(0 100% 0 0)',
                animation: hashAnimation,
              }}
            >
              {hash}
            </Box>
          </Box>
        </Typography>
      ) : (
        <Typography
          noWrap
          sx={{
            alignItems: 'center',
            alignSelf: 'stretch',
            display: 'flex',
            flex: '1 1 auto',
            fontFamily: 'monospace',
            minWidth: 0,
          }}
        >
          {hash}
        </Typography>
      )}
      <Box sx={{ alignItems: 'center', display: 'flex', flexShrink: 0 }}>
        <BaseIconButton
          aria-label={t('copy_to_clipboard')}
          color="inherit"
          onClick={handleCopy}
          size="small"
          tooltip={t('copy_to_clipboard')}
        >
          <ContentCopyIcon />
        </BaseIconButton>
        {registeredName && (
          <BaseIconButton
            aria-label={t(isHashVisible ? 'show_registered_name' : 'show_jami_id')}
            aria-pressed={isHashVisible}
            color="inherit"
            onClick={() => {
              const nextIsHashVisible = !isHashVisible
              const nextWidth = getIdentityWidth(nextIsHashVisible)

              if (expansionTimerRef.current !== undefined) {
                window.clearTimeout(expansionTimerRef.current)
              }

              setHasToggledIdentity(true)
              setIsHashVisible(nextIsHashVisible)

              if (nextWidth > 0 && nextWidth !== identitySlotWidthRef.current) {
                setIdentitySlotWidth(0)
                expansionTimerRef.current = window.setTimeout(() => {
                  identitySlotWidthRef.current = nextWidth
                  setIdentitySlotWidth(nextWidth)
                  expansionTimerRef.current = undefined
                }, IDENTITY_ANIMATION_DURATION)
              }
            }}
            size="small"
            tooltip={t(isHashVisible ? 'show_registered_name' : 'show_jami_id')}
          >
            <FingerprintIcon />
          </BaseIconButton>
        )}
        <BaseIconButton
          aria-label={t('contact_details_qr_code')}
          color="inherit"
          onClick={() => setIsQrCodeModalOpen(true)}
          size="small"
          tooltip={t('contact_details_qr_code')}
        >
          <QrCodeIcon />
        </BaseIconButton>
      </Box>
      <QrCodeModal account={account} open={isQrCodeModalOpen} onClose={() => setIsQrCodeModalOpen(false)} />
    </Box>
  )
}
