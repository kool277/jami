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

import { useSyncExternalStore } from 'react'

const DISABLE_TIPS_STORAGE_KEY = 'disable-tips'
const TIPS_VISIBILITY_CHANGE_EVENT = 'tips-visibility-change'

const subscribeToTipsVisibility = (onStoreChange: () => void) => {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === DISABLE_TIPS_STORAGE_KEY) {
      onStoreChange()
    }
  }

  window.addEventListener(TIPS_VISIBILITY_CHANGE_EVENT, onStoreChange)
  window.addEventListener('storage', handleStorageChange)

  return () => {
    window.removeEventListener(TIPS_VISIBILITY_CHANGE_EVENT, onStoreChange)
    window.removeEventListener('storage', handleStorageChange)
  }
}

export const areTipsEnabled = () => localStorage.getItem(DISABLE_TIPS_STORAGE_KEY) !== 'true'

export const setTipsEnabled = (enabled: boolean) => {
  if (enabled) {
    localStorage.removeItem(DISABLE_TIPS_STORAGE_KEY)
  } else {
    localStorage.setItem(DISABLE_TIPS_STORAGE_KEY, 'true')
  }

  window.dispatchEvent(new Event(TIPS_VISIBILITY_CHANGE_EVENT))
}

export const useTipsEnabled = () => useSyncExternalStore(subscribeToTipsVisibility, areTipsEnabled)
