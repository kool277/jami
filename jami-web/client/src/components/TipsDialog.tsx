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

import { Box, IconButton, Typography, useTheme } from '@mui/material'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTipsEnabled } from '../utils/tips.js'
import BaseButton from './common/BaseButton.js'
import BaseModalDialog from './common/BaseModalDialog.js'
import { ChevronLeftIcon, ChevronRightIcon, TipIcon } from './SvgIcon.js'

export default function TipsDialog() {
  const { t } = useTranslation()
  const theme = useTheme()
  const tipsEnabled = useTipsEnabled()
  const tipIconColor = theme.palette.mode === 'light' ? 'rgb(128, 93, 0)' : '#ffcc00'
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTipIndex, setSelectedTipIndex] = useState(0)
  const [focusPreviousButton, setFocusPreviousButton] = useState(false)
  const [hasNavigated, setHasNavigated] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const paperId = useId()
  const tips = [
    { title: t('tip_1_title'), description: t('tip_1_description') },
    { title: t('tip_2_title'), description: t('tip_2_description') },
    { title: t('tip_3_title'), description: t('tip_3_description') },
    { title: t('tip_4_title'), description: t('tip_4_description') },
    { title: t('tip_5_title'), description: t('tip_5_description') },
    { title: t('tip_6_title'), description: t('tip_6_description') },
    { title: t('tip_7_title'), description: t('tip_7_description') },
    { title: t('tip_8_title'), description: t('tip_8_description') },
    { title: t('tip_9_title'), description: t('tip_9_description') },
    { title: t('tip_10_title'), description: t('tip_10_description') },
    { title: t('tip_11_title'), description: t('tip_11_description') },
  ]
  const currentTip = tips[selectedTipIndex]

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setHasNavigated(false)
    triggerRef.current?.focus()
  }, [])

  const handleToggle = () => {
    if (isOpen) {
      handleClose()
      return
    }

    setFocusPreviousButton(selectedTipIndex === tips.length - 1)
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen || !tipsEnabled) {
      return
    }

    const handleClickAway = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (triggerRef.current?.contains(target) || document.getElementById(paperId)?.contains(target)) {
        return
      }
      handleClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('click', handleClickAway)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', handleClickAway)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose, isOpen, paperId, tipsEnabled])

  if (!tipsEnabled) {
    return null
  }

  return (
    <>
      <IconButton
        ref={triggerRef}
        aria-label={t('tips')}
        aria-controls={paperId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={handleToggle}
        sx={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          color: tipIconColor,
        }}
      >
        <TipIcon />
      </IconButton>
      <BaseModalDialog
        open={isOpen}
        selectedValue=""
        title={t('tips')}
        titleIcon={<TipIcon sx={{ color: tipIconColor }} />}
        titleSuffix={
          <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
            ({selectedTipIndex + 1}/{tips.length})
          </Typography>
        }
        nonModal
        paperId={paperId}
        dialogWidth="320px"
        paperSx={{
          position: 'fixed',
          right: '16px',
          bottom: '72px',
          margin: 0,
          maxHeight: 'calc(100% - 88px)',
        }}
        onClose={handleClose}
        closePolicy={['escapeKeyDown']}
        actions={
          <>
            <BaseButton
              variant="text"
              autoFocus={focusPreviousButton}
              startIcon={<ChevronLeftIcon />}
              disabled={selectedTipIndex === 0}
              onClick={() => {
                setSelectedTipIndex((index) => index - 1)
                setHasNavigated(true)
              }}
            >
              {t('previous')}
            </BaseButton>
            <BaseButton
              variant="text"
              autoFocus={!focusPreviousButton}
              endIcon={<ChevronRightIcon />}
              disabled={selectedTipIndex === tips.length - 1}
              onClick={() => {
                setSelectedTipIndex((index) => index + 1)
                setHasNavigated(true)
              }}
            >
              {t('next')}
            </BaseButton>
          </>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Box
            aria-live="polite"
            aria-atomic="true"
            sx={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {hasNavigated && `${currentTip.title}. ${currentTip.description}`}
          </Box>
          <Typography sx={{ fontWeight: 'bold' }}>{currentTip.title}</Typography>
          <Typography>{currentTip.description}</Typography>
        </Box>
      </BaseModalDialog>
    </>
  )
}
