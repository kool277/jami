/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { Paper, type PaperProps } from '@mui/material'
import { type Ref, useEffect, useMemo, useRef, useState } from 'react'

const duration = 180

const expandMenu = keyframes`
  from { opacity: 0; transform: scaleY(0); }
  to { opacity: 1; transform: scaleY(1); }
`

const collapseMenu = keyframes`
  from { opacity: 1; transform: scaleY(1); }
  to { opacity: 0; transform: scaleY(0); }
`

type AnimatedPaperProps = PaperProps & { ref?: Ref<HTMLDivElement> }

export function getAutocompleteMenuTransformOrigin(placement: string | null | undefined) {
  return placement?.startsWith('top') ? 'bottom' : 'top'
}

export function useAutocompleteMenuAnimation() {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [placement, setPlacement] = useState<string>()
  const [animationReady, setAnimationReady] = useState(false)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const transformOrigin = getAutocompleteMenuTransformOrigin(placement)

  const OpeningPaper = useMemo(
    () =>
      function OpeningPaper({ children, ref, ...props }: AnimatedPaperProps) {
        return (
          <Paper
            ref={ref}
            {...props}
            sx={{
              animation: animationReady ? `${expandMenu} ${duration}ms ease-out` : 'none',
              opacity: animationReady ? undefined : 0,
              transform: animationReady ? undefined : 'scaleY(0)',
              transformOrigin,
            }}
          >
            {children}
          </Paper>
        )
      },
    [animationReady, transformOrigin],
  )

  const ClosingPaper = useMemo(
    () =>
      function ClosingPaper({ children, ref, ...props }: AnimatedPaperProps) {
        return (
          <Paper
            ref={ref}
            {...props}
            sx={{ animation: `${collapseMenu} ${duration}ms ease-out forwards`, transformOrigin }}
          >
            {children}
          </Paper>
        )
      },
    [transformOrigin],
  )

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])

  return {
    open,
    closing,
    slots: { paper: closing ? ClosingPaper : OpeningPaper },
    slotProps: {
      popper: {
        popperOptions: {
          onFirstUpdate: ({ placement }: { placement?: string }) => {
            setPlacement(placement)
            setAnimationReady(true)
          },
        },
      },
    },
    popupIndicatorSx: {
      '& .MuiAutocomplete-popupIndicator': {
        transform: open && !closing ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: `transform ${duration}ms ease-out`,
      },
    },
    onOpen: () => {
      window.clearTimeout(closeTimerRef.current)
      setPlacement(undefined)
      setAnimationReady(false)
      setClosing(false)
      setOpen(true)
    },
    // MUI mirrors the controlled `open` prop into its own state, so while the collapse animation
    // keeps the prop true it believes the menu is already open and skips `onOpen`. Clicking an
    // empty input asks it to close, so without this the pending close would silently win and leave
    // the user typing into a menu that never comes back.
    onInputChange: (value: string, reason: string) => {
      if (reason !== 'input' || value === '') {
        return
      }

      window.clearTimeout(closeTimerRef.current)
      setClosing(false)
      setOpen(true)
    },
    onClose: () => {
      if (!open || closing) {
        return
      }

      setClosing(true)
      closeTimerRef.current = window.setTimeout(() => {
        setOpen(false)
        setClosing(false)
      }, duration)
    },
  }
}
