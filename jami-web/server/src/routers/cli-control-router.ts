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
import { HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'

import { createCliAccount, createCliBot, listCliAccounts, removeCliAccount } from '../services/cli-control-service.js'

export const cliControlRouter = Router()

cliControlRouter.get('/health', (_req, res) => {
  res.status(HttpStatusCode.Ok).send({ status: 'ok' })
})

cliControlRouter.get(
  '/accounts',
  asyncHandler(async (_req, res) => {
    res.status(HttpStatusCode.Ok).send(await listCliAccounts())
  }),
)

cliControlRouter.post(
  '/accounts',
  asyncHandler(async (req, res) => {
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName : ''
    const password = typeof req.body.password === 'string' ? req.body.password : ''

    if (!password) {
      res.status(HttpStatusCode.BadRequest).send('Password is required')
      return
    }

    try {
      const account = await createCliAccount({
        displayName,
        password,
      })

      res.status(HttpStatusCode.Created).send(account)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message === 'Local authentication is disabled') {
        res.status(HttpStatusCode.BadRequest).send(message)
        return
      }
      throw error
    }
  }),
)

cliControlRouter.delete(
  '/accounts/:accountId',
  asyncHandler<{ accountId: string }>(async (req, res) => {
    const accountId = req.params.accountId?.trim()
    if (!accountId) {
      res.status(HttpStatusCode.BadRequest).send('Missing accountId')
      return
    }

    try {
      const result = await removeCliAccount(accountId)
      res.status(HttpStatusCode.Ok).send(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Account not found:')) {
        res.status(HttpStatusCode.NotFound).send(message)
        return
      }
      throw error
    }
  }),
)

cliControlRouter.post(
  '/bots',
  asyncHandler(async (req, res) => {
    const displayName = typeof req.body.displayName === 'string' ? req.body.displayName : ''
    const owner = typeof req.body.owner === 'string' ? req.body.owner : ''

    if (!displayName) {
      res.status(HttpStatusCode.BadRequest).send('Display name is required')
      return
    }

    if (!owner) {
      res.status(HttpStatusCode.BadRequest).send('Owner is required')
      return
    }

    try {
      const bot = await createCliBot({
        displayName,
        owner,
      })
      res.status(HttpStatusCode.Created).send(bot)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.startsWith('Owner account not found:')) {
        res.status(HttpStatusCode.NotFound).send(message)
        return
      }
      if (message.startsWith('No Jami accounts are available.')) {
        res.status(HttpStatusCode.BadRequest).send(message)
        return
      }
      throw error
    }
  }),
)
