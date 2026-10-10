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

import { use, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingSwitch } from '../../../components/Settings.js'
import { NotificationContext } from '../../../contexts/NotificationsProvider.js'

const SettingNotifications = ({ controlOnly = false }: { controlOnly?: boolean }) => {
  const { t } = useTranslation()
  const { enable, setIsEnabled } = use(NotificationContext)

  const [isOn, setIsOn] = useState<boolean>(enable)

  const onChange = useCallback(() => {
    setIsEnabled(!isOn)
    setIsOn((isOn) => !isOn)
  }, [isOn, setIsEnabled])

  return (
    <SettingSwitch
      controlOnly={controlOnly}
      label={t('settings_menu_item_notifications')}
      onChange={onChange}
      checked={isOn}
    />
  )
}

export default SettingNotifications
