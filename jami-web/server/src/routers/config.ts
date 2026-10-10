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
import { HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import fs from 'fs'

import { getAvailableLanguages, getTranslationPath } from '../utils/locales.js'

export const configRouter = Router()

configRouter.get(
  '/languages',
  asyncHandler(async (_req, res) => {
    try {
      const languages = await getAvailableLanguages()

      if (!languages) {
        res.status(HttpStatusCode.InternalServerError).send({ error: 'Error reading available languages' })
        return
      }
      res.send(languages)
    } catch (error) {
      res.status(HttpStatusCode.InternalServerError).send({ error: (error as Error).message })
    }
  }),
)

configRouter.get(
  '/languages/:language',
  asyncHandler<{ language: string }>(async (req, res) => {
    const language = req.params.language
    try {
      const availableLanguages = await getAvailableLanguages()
      if (!availableLanguages) {
        res.status(HttpStatusCode.InternalServerError).send({ error: 'Error reading available languages' })
        return
      }
      const languageExists = availableLanguages.find((lang) => lang.tag === language)
      if (!languageExists && language !== 'en') {
        res.status(HttpStatusCode.BadRequest).send({ error: 'Language not available' })
        return
      }

      const path = getTranslationPath(language)

      if (!fs.existsSync(path)) {
        res.status(HttpStatusCode.InternalServerError).send({ error: 'Error reading language file' })
        return
      }

      const data = fs.readFileSync(path)
      const content = JSON.parse(data.toString())

      res.send(content)
    } catch (error) {
      res.status(HttpStatusCode.InternalServerError).send({ error: (error as Error).message })
    }
  }),
)
