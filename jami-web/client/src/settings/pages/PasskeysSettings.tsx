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

import { useAuthContext } from '../../contexts/AuthProvider.js'
import ChangePassword from '../components/AccountSettings/ChangePassword.js'
import PasskeyManager from '../components/AccountSettings/PasskeyManager.js'
import { SettingsPage, SettingsSection } from '../components/SettingsPage.js'

export default function PasskeysSettings() {
  const { t } = useTranslation()
  const { account } = useAuthContext()

  return (
    <SettingsPage title={t('password_and_passkeys')}>
      {account.canChangePassword && (
        <SettingsSection title={t('change_password')} description={t('change_password_description')} list={false}>
          <ChangePassword />
        </SettingsSection>
      )}
      <PasskeyManager />
    </SettingsPage>
  )
}
