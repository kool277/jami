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
import { createContext, useCallback, useMemo, useState } from 'react'

import { WithChildren } from '../utils/utils.js'

interface INotificationContext {
  enable: boolean
  setIsEnabled(value: boolean): void
}

export const NotificationContext = createContext<INotificationContext>({
  enable: true,
  setIsEnabled: () => {},
})

export default ({ children }: WithChildren) => {
  const [enable, setEnable] = useState<boolean>(() => {
    const NotificationInStorage = localStorage.getItem('notification-preference')
    if (typeof NotificationInStorage === 'string') {
      return JSON.parse(NotificationInStorage)
    }
    return true
  })

  const setIsEnabled = useCallback((value: boolean) => {
    setEnable(value)
    localStorage.setItem('notification-preference', JSON.stringify(value))
  }, [])

  const value = useMemo(
    () => ({
      enable,
      setIsEnabled,
    }),
    [enable, setIsEnabled],
  )

  return <NotificationContext value={value}>{children}</NotificationContext>
}
