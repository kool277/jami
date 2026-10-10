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
import { useTranslation } from 'react-i18next'

import SettingLanguage from '../../../components/SettingLanguage.js'
import { SettingsPage, SettingsRow, SettingsSection } from '../SettingsPage.js'
import SettingAnimations from './SettingAnimations.js'
import SettingLinkPreview from './SettingLinkPreview.js'
import SettingNotifications from './SettingNotifications.js'
import SettingTheme from './SettingTheme.js'
import SettingTips from './SettingTips.js'

export type GeneralSettingsSection = 'system' | 'appearance' | 'chat'

function System({ section = 'system' }: { section?: GeneralSettingsSection }) {
  const { t } = useTranslation()
  const pageTitleKey = {
    system: 'settings_title_system',
    appearance: 'settings_appearance',
    chat: 'settings_title_chat',
  } as const

  return (
    <SettingsPage title={t(pageTitleKey[section])}>
      {section === 'system' && (
        <SettingsSection>
          <SettingsRow title={t('settings_menu_item_notifications')} control={<SettingNotifications controlOnly />} />
          <SettingsRow title={t('settings_language')} control={<SettingLanguage doNotDisplayLabel />} />
        </SettingsSection>
      )}
      {section === 'appearance' && (
        <SettingsSection>
          <SettingsRow title={t('settings_dark_theme')} control={<SettingTheme controlOnly />} />
          <SettingsRow title={t('settings_enable_animations')} control={<SettingAnimations controlOnly />} />
          <SettingsRow title={t('show_tips')} control={<SettingTips controlOnly />} />
        </SettingsSection>
      )}
      {section === 'chat' && (
        <SettingsSection title={t('settings_title_view')}>
          <SettingsRow title={t('settings_link_preview')} control={<SettingLinkPreview controlOnly />} />
        </SettingsSection>
      )}
    </SettingsPage>
  )
}

export default System
