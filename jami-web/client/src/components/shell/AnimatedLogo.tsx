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
import { Box, useMediaQuery, useTheme } from '@mui/material'
import { useCallback, useRef } from 'react'

/**
 * The clips are encoded over the rail's own surface colour, one per palette
 * mode, because they carry no alpha channel of their own.
 */
const LOGO_LIGHT = '/logo_light.webm'
const LOGO_DARK = '/logo_dark.webm'

export interface AnimatedLogoProps {
  size?: number
}

/**
 * The Jami mark at the foot of the rail. It rests on its first frame and only
 * animates while pointed at, so the rail stays still during normal use.
 */
export default function AnimatedLogo({ size = 40 }: AnimatedLogoProps) {
  const theme = useTheme()
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const videoRef = useRef<HTMLVideoElement>(null)

  const play = useCallback(() => {
    if (prefersReducedMotion) {
      return
    }
    // A rejected play promise is not an error worth surfacing: the mark is
    // decorative, and its still frame is a complete state of its own.
    videoRef.current?.play().catch(() => {})
  }, [prefersReducedMotion])

  const stop = useCallback(() => {
    const video = videoRef.current
    if (!video) {
      return
    }
    video.pause()
    video.currentTime = 0
  }, [])

  return (
    <Box
      ref={videoRef}
      component="video"
      // Decorative: the mark repeats branding the window title already carries.
      aria-hidden
      src={theme.palette.mode === 'dark' ? LOGO_DARK : LOGO_LIGHT}
      loop
      muted
      playsInline
      preload="auto"
      onMouseEnter={play}
      onMouseLeave={stop}
      sx={{ width: size, height: size, flexShrink: 0 }}
    />
  )
}
