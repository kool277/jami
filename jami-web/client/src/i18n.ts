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
import i18n, { ResourceLanguage } from 'i18next'
import { initReactI18next } from 'react-i18next'

import { apiUrl } from './utils/constants.js'

interface LanguageInfo {
  readonly tag: LanguageTag
  readonly fullName: string
}

async function getAvailableLanguages(): Promise<LanguageInfo[]> {
  try {
    const response = await fetch(apiUrl + '/config/languages')
    if (!response.ok) {
      throw new Error(`Failed to fetch available languages: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching available languages:', error)
    return []
  }
}

async function getTranslation(language: string): Promise<ResourceLanguage> {
  try {
    const response = await fetch(apiUrl + `/config/languages/${language}/`)
    if (!response.ok) {
      throw new Error(`Failed to fetch translation: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Error fetching translation for ${language}:`, error)
    return {}
  }
}

const availableLanguages = await getAvailableLanguages()
export type LanguageTag = string

export const languagesInfos: readonly LanguageInfo[] = availableLanguages
const availableLanguageTags = new Set(languagesInfos.map((language) => language.tag))

const lastLanguage = localStorage.getItem('language')
// transifex uses underscores instead of dashes
const systemLanguage = navigator.language.replace('-', '_')
const getSystemLanguage = () => (availableLanguageTags.has(systemLanguage) ? systemLanguage : 'en')
const defaultLanguage = lastLanguage && availableLanguageTags.has(lastLanguage) ? lastLanguage : getSystemLanguage()

const initialResources = await getTranslation(defaultLanguage)

await i18n.use(initReactI18next).init({
  debug: import.meta.env.DEV,
  lng: defaultLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

i18n.addResourceBundle(defaultLanguage, 'translation', initialResources)
// Always load the English bundle so keys missing from a translation
// (e.g. recently added strings not yet translated) fall back to English
// instead of displaying the raw translation key.
if (defaultLanguage !== 'en') {
  const fallbackResources = await getTranslation('en')
  i18n.addResourceBundle('en', 'translation', fallbackResources)
}
i18n.changeLanguage(defaultLanguage)

const loadLanguage = async (language: string) => {
  if (i18n.hasResourceBundle(language, 'translation')) {
    return
  }
  const translation = await getTranslation(language)
  i18n.addResourceBundle(language, 'translation', translation)
}

export const loadLanguageAsync = async (language: string) => {
  localStorage.setItem('language', language)
  await loadLanguage(language)
}

export const resetLanguageToSystem = async () => {
  localStorage.removeItem('language')
  const language = getSystemLanguage()
  await loadLanguage(language)
  await i18n.changeLanguage(language)
}

export default i18n
