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
import { HttpStatusCode, IContact } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'

const jamid = Container.get(Jamid)

export const defaultModeratorsRouter = Router()

defaultModeratorsRouter.use(authenticateToken)
defaultModeratorsRouter.use(requireApiTokenScope('account'))

defaultModeratorsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const accountId = res.locals.accountId
    // Add usernames for default moderators
    const defaultModeratorUris = jamid.getDefaultModeratorUris(accountId)
    const namedDefaultModerators: IContact[] = []
    for (const defaultModeratorUri of defaultModeratorUris) {
      try {
        const { name } = await jamid.lookupAddress(defaultModeratorUri, '', accountId)
        namedDefaultModerators.push({
          uri: defaultModeratorUri,
          registeredName: name,
        })
      } catch (e) {
        namedDefaultModerators.push({
          uri: defaultModeratorUri,
          registeredName: defaultModeratorUri,
        })
      }
    }
    res.send(namedDefaultModerators)
  }),
)

defaultModeratorsRouter.put('/:contactId', (req, res) => {
  jamid.addDefaultModerator(res.locals.accountId, req.params.contactId)
  res.sendStatus(HttpStatusCode.NoContent)
})

defaultModeratorsRouter.delete('/:contactId', (req, res) => {
  jamid.removeDefaultModerator(res.locals.accountId, req.params.contactId)
  res.sendStatus(HttpStatusCode.NoContent)
})
