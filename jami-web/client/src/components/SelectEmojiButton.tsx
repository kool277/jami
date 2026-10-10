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
import { Box, ClickAwayListener, Popper } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { type Instance as PopperInstance } from '@popperjs/core'
import {
  type ComponentProps,
  lazy,
  type MouseEvent,
  Suspense,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { type EmojiClickData } from '../utils/emojiPicker.js'
import BaseIconButton from './common/BaseIconButton.js'
import { EmojiIcon } from './SvgIcon.js'

const EmojiPicker = lazy(() => import('../utils/emojiPicker.js').then((module) => ({ default: module.EmojiPicker })))

type PositionedEmojiPickerProps = ComponentProps<typeof EmojiPicker> & {
  onMount: () => void
}

const PositionedEmojiPicker = ({ onMount, ...props }: PositionedEmojiPickerProps) => {
  useLayoutEffect(onMount, [onMount])

  return <EmojiPicker {...props} />
}

type SelectEmojiButtonProps = {
  onEmojiSelected: (emoji: string) => void
}

export default function SelectEmojiButton({ onEmojiSelected }: SelectEmojiButtonProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const popperRef = useRef<PopperInstance | null>(null)
  const { t } = useTranslation()
  const theme = useTheme()
  const handleOpenEmojiPicker = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => setAnchorEl(anchorEl ? null : e.currentTarget),
    [anchorEl],
  )
  const handleClose = useCallback(() => setAnchorEl(null), [setAnchorEl])
  const updatePickerPosition = useCallback(() => popperRef.current?.forceUpdate(), [])

  const onEmojiClick = useCallback(
    (emoji: EmojiClickData) => {
      onEmojiSelected(emoji.emoji)
      handleClose()
    },
    [handleClose, onEmojiSelected],
  )

  const open = Boolean(anchorEl)
  const id = open ? 'emoji-picker-popper' : undefined

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Box>
        <BaseIconButton
          aria-describedby={id}
          aria-label={t('button_select_emoji')}
          tooltip={t('button_select_emoji')}
          sx={{ fontSize: '25px', height: '36px', width: '36px' }}
          onClick={handleOpenEmojiPicker}
        >
          <EmojiIcon fontSize="inherit" />
        </BaseIconButton>
        <Popper sx={{ zIndex: 2 }} id={id} open={open} anchorEl={anchorEl} popperRef={popperRef}>
          <Suspense fallback={null}>
            <PositionedEmojiPicker
              onMount={updatePickerPosition}
              theme={theme.EmojiPicker.backgroundColor}
              onEmojiClick={onEmojiClick}
              autoFocusSearch={false}
              skinTonesDisabled={true}
            />
          </Suspense>
        </Popper>
      </Box>
    </ClickAwayListener>
  )
}
