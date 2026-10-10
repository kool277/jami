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
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '../..')
const availableLanguagesPath = path.join(packageRoot, 'available_languages.json')

export function getTranslationPath(language: string) {
  return path.join(packageRoot, 'locale', language, 'translation.json')
}

export async function getAvailableLanguages() {
  try {
    if (!fs.existsSync(availableLanguagesPath)) {
      throw new Error(`Available languages file not found: ${availableLanguagesPath}`)
    }

    const data = fs.readFileSync(availableLanguagesPath)
    const content = JSON.parse(data.toString())

    const languages = []

    // add english as default language
    languages.push({
      tag: 'en',
      fullName: 'English',
    })

    for (const language of content.data) {
      const tag = language.attributes.code
      if (!fs.existsSync(getTranslationPath(tag))) {
        continue
      }

      languages.push({
        tag,
        fullName: language.attributes.name,
      })
    }

    return languages
  } catch (error) {
    console.error('Error reading available languages:', error)
    throw error
  }
}
