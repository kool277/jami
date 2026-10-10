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

import { useCallback, useRef, useState } from 'react'

const UseLongPress = (callback: () => void, ms: number = 500) => {
  const [longPressStarted, setLongPressStarted] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startPressTimer = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setLongPressStarted(true)
      callback()
    }, ms)
  }, [callback, ms])

  const cancelPressTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (longPressStarted) {
      setLongPressStarted(false)
    }
  }, [longPressStarted])

  return {
    onTouchStart: startPressTimer,
    onTouchEnd: cancelPressTimer,
    onTouchMove: cancelPressTimer,
  }
}

export default UseLongPress
