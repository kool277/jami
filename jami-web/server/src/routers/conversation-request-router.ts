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
import { HttpStatusCode, IConversationRequest } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'
import { ConversationService } from '../services/ConversationService.js'
import { cacheAvatar } from '../utils/vCard.js'

const jamid = Container.get(Jamid)
const conversationService = Container.get(ConversationService)

export const conversationRequestRouter = Router()

conversationRequestRouter.use(authenticateToken)
conversationRequestRouter.use(extendIfGuest)
conversationRequestRouter.use(requireApiTokenScope('conversations'))

conversationRequestRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const accountId = res.locals.accountId
    const jamidRequests = jamid.getConversationRequests(accountId)
    Promise.all(
      jamidRequests.map((jamidRequest) => conversationService.createConversationRequest(accountId, jamidRequest)),
    )
      .then((apiRequests: IConversationRequest[]) => res.send(apiRequests))
      .catch((err) => res.status(HttpStatusCode.InternalServerError).send(err.message))
  }),
)

conversationRequestRouter.post(
  '/:conversationId',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId
    const conversationRequest = jamid
      .getConversationRequests(accountId)
      .find((request) => request.id === conversationId)
    await jamid.acceptConversationRequest(accountId, conversationId)
    if (conversationRequest?.avatar) {
      try {
        await cacheAvatar(accountId, conversationRequest.from, conversationRequest.avatar)
      } catch (error) {
        console.error('Failed to cache conversation request avatar', error)
      }
    }
    const conversationSummary = await conversationService.createConversationSummary(accountId, conversationId)
    if (conversationSummary === undefined) {
      res.status(HttpStatusCode.NotFound).send('No such conversation found')
      return
    }
    res.send(conversationSummary)
  }),
)

conversationRequestRouter.delete(
  '/:conversationId',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    jamid.declineConversationRequest(res.locals.accountId, req.params.conversationId)
    res.sendStatus(HttpStatusCode.NoContent)
  }),
)

conversationRequestRouter.post('/:conversationId/block', (req, res) => {
  const accountId = res.locals.accountId
  const conversationId = req.params.conversationId
  const conversationRequests = jamid.getConversationRequests(accountId)
  const conversationRequest = conversationRequests.filter((request) => request.id === conversationId)[0]
  if (!conversationRequest) {
    res.status(HttpStatusCode.NotFound).send('No such conversation request found')
  }
  jamid.blockContact(accountId, conversationRequest.from)
  res.sendStatus(HttpStatusCode.NoContent)
})
