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
import { HttpStatusCode, RegisteredNameFoundState } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateOptionalToken } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'

const jamid = Container.get(Jamid)

export const nameserverRouter = Router()

nameserverRouter.use(authenticateOptionalToken)
nameserverRouter.use(extendIfGuest)

nameserverRouter.get(
  '/name/:username',
  asyncHandler<{ username: string }>(async (req, res) => {
    try {
      const result = await jamid.lookupUsername(req.params.username, '', res.locals.accountId)
      switch (result.state) {
        case RegisteredNameFoundState.Found:
          res.status(HttpStatusCode.Ok).send(result)
          break
        case RegisteredNameFoundState.InvalidResponse:
          res.status(HttpStatusCode.BadRequest).send('Invalid username')
          break
        default:
          res.status(HttpStatusCode.NotFound).send('No such username found')
          break
      }
    } catch (e) {
      res.status(HttpStatusCode.InternalServerError).end()
    }
  }),
)

nameserverRouter.get(
  '/jams/:username',
  asyncHandler<{ username: string }>(async (req, res) => {
    try {
      const result = await jamid.searchUser(res.locals.accountId, req.params.username)
      switch (result.state) {
        case RegisteredNameFoundState.Found:
          res.status(HttpStatusCode.Ok).send(result)
          break
        case RegisteredNameFoundState.InvalidResponse:
          res.status(HttpStatusCode.BadRequest).send('Invalid username')
          break
        default:
          res.status(HttpStatusCode.NotFound).send('No such username found')
          break
      }
    } catch (e) {
      res.status(HttpStatusCode.InternalServerError).end()
    }
  }),
)

nameserverRouter.head(
  '/name/:username',
  asyncHandler<{ username: string }>(async (req, res) => {
    try {
      const result = await jamid.lookupUsername(req.params.username, '', res.locals.accountId)
      switch (result.state) {
        case RegisteredNameFoundState.Found:
          res.status(HttpStatusCode.Ok).end()
          break
        case RegisteredNameFoundState.InvalidResponse:
          res.status(HttpStatusCode.BadRequest).end()
          break
        default:
          res.status(HttpStatusCode.NotFound).end()
          break
      }
    } catch (e) {
      res.status(HttpStatusCode.InternalServerError).end()
    }
  }),
)

nameserverRouter.get(
  '/address/:address',
  asyncHandler<{ address: string }>(async (req, res) => {
    if (req.params.address === undefined) {
      res.status(HttpStatusCode.BadRequest).send('Invalid address')
      return
    }
    try {
      const result = await jamid.lookupAddress(req.params.address, '', res.locals.accountId)
      switch (result.state) {
        case RegisteredNameFoundState.Found:
          res.send(result)
          break
        case RegisteredNameFoundState.InvalidResponse:
          res.status(HttpStatusCode.BadRequest).send('Invalid address')
          break
        default:
          res.status(HttpStatusCode.NotFound).send('No such address found')
          break
      }
    } catch (e) {
      res.status(HttpStatusCode.InternalServerError).end()
    }
  }),
)
