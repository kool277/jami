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
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// The application loads translations over HTTP from the server at runtime. Storybook runs without
// that server, so it reads the same English bundle straight from the repository instead of
// duplicating strings, which would drift from the shipped translations.
import englishTranslation from '../../server/locale/en/translation.json'

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: englishTranslation } },
  interpolation: { escapeValue: false },
})

export default i18n
