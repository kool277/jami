/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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

import ContactList from '../components/ContactList.js'
import AppShell from '../components/shell/AppShell.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'

export default function Contacts() {
  const { t } = useTranslation()
  useDocumentTitle(t('settings_menu_item_contacts'))

  return <AppShell listRoute="/contacts" listPaneLabel={t('settings_menu_item_contacts')} listPane={<ContactList />} />
}
