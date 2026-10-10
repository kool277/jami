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
import {
  ContactDetails,
  HttpStatusCode,
  MESSAGES_NUMBER_TO_LOAD,
  NewConversationRequestBody,
  NewMessageRequestBody,
  SendMessageType,
} from '@savoirfairelinux/jami-web-common'
import { Request, Router } from 'express'
import asyncHandler from 'express-async-handler'
import { ParamsDictionary } from 'express-serve-static-core'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'
import { ContactService } from '../services/ContactService.js'
import { ConversationService } from '../services/ConversationService.js'

const jamid = Container.get(Jamid)
const conversationService = Container.get(ConversationService)
const contactService = Container.get(ContactService)

export const conversationRouter = Router()

conversationRouter.use(authenticateToken)
conversationRouter.use(extendIfGuest)
conversationRouter.use(requireApiTokenScope('conversations'))

conversationRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const accountId = res.locals.accountId

    const conversationIds = jamid.getConversationIds(accountId)

    const conversationSummariesPromises = conversationIds.map(async (conversationId) => {
      const conversationSummary = await conversationService.createConversationSummary(accountId, conversationId)
      if (conversationSummary) {
        conversationSummary.mode = jamid.getConversationInfos(accountId, conversationId).mode
        return conversationSummary
      }
    })

    const conversationsSummaries = (await Promise.all(conversationSummariesPromises)).filter(Boolean)
    res.send(conversationsSummaries)
  }),
)

conversationRouter.post(
  '/',
  (req: Request<ParamsDictionary, ContactDetails | string, Partial<NewConversationRequestBody>>, res) => {
    const { members } = req.body
    if (members === undefined || members.length !== 1) {
      res.status(HttpStatusCode.BadRequest).send('Missing members or more than one member in body')
      return
    }

    const accountId = res.locals.accountId

    const contactId = members[0]
    jamid.addContact(accountId, contactId)
    // We need to manually send a conversation request
    jamid.sendTrustRequest(accountId, contactId)

    const contactDetails = jamid.getContactDetails(accountId, contactId)
    if (Object.keys(contactDetails).length === 0) {
      res.status(HttpStatusCode.NotFound).send('No such member found')
      return
    }

    res.send(contactDetails)
  },
)

conversationRouter.get(
  '/:conversationId',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    const conversationSummary = await conversationService.createConversationSummary(accountId, conversationId)
    if (conversationSummary === undefined) {
      res.status(HttpStatusCode.NotFound).send('No such conversation found')
      return
    }

    res.send(conversationSummary)
  }),
)

conversationRouter.get(
  '/:conversationId/infos',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    const infos = jamid.getConversationInfos(accountId, conversationId)
    if (Object.keys(infos).length === 0) {
      res.status(HttpStatusCode.NotFound).send('No such conversation found')
      return
    }

    res.send({
      ...infos,
      avatar:
        infos.avatar && !infos.avatar.startsWith('data:') ? `data:image/jpeg;base64,${infos.avatar}` : infos.avatar,
    })
  }),
)

conversationRouter.post('/:conversationId/infos', (req, res) => {
  const accountId = res.locals.accountId
  const conversationId = req.params.conversationId
  const infos = req.body

  if (Object.keys(infos).length === 0) {
    res.status(HttpStatusCode.BadRequest)
    return
  }
  jamid.updateConversationInfos(accountId, conversationId, infos)
  res.sendStatus(HttpStatusCode.Ok)
})

conversationRouter.get(
  '/:conversationId/preferences',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    const preferences = jamid.getConversationPreferences(accountId, conversationId)
    if (Object.keys(preferences).length === 0) {
      res.status(HttpStatusCode.NotFound).send('No such conversation found')
      return
    }

    if (
      'ignoreNotifications' in preferences &&
      preferences.ignoreNotifications &&
      typeof preferences.ignoreNotifications === 'string'
    ) {
      preferences.ignoreNotifications = preferences.ignoreNotifications === 'true' ? true : false
    }

    res.send(preferences)
  }),
)

conversationRouter.post('/:conversationId/preferences', (req, res) => {
  const accountId = res.locals.accountId
  const conversationId = req.params.conversationId
  const preferences = req.body

  if (Object.keys(preferences).length === 0) {
    res.status(HttpStatusCode.BadRequest).send('Invalid preferences provided')
    return
  }

  const preferencesSet = jamid.getConversationPreferences(accountId, conversationId) as { [key: string]: any }

  Object.keys(preferences).forEach((key) => {
    if (preferencesSet[key] !== preferences[key]) {
      preferencesSet[key] = preferences[key]
    }
  })

  jamid.setConversationPreferences(accountId, conversationId, preferencesSet)
  res.sendStatus(HttpStatusCode.NoContent)
})

conversationRouter.get(
  '/:conversationId/members',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    const infos = jamid.getConversationInfos(accountId, conversationId)
    if (Object.keys(infos).length === 0) {
      res.status(HttpStatusCode.NotFound).send('No such conversation found')
      return
    }

    const members = jamid.getConversationMembers(accountId, conversationId)
    const namedMembersPromises = members.map(async (member) => ({
      role: member.role,
      contact: await contactService.getContactFromUri(accountId, member.uri),
    }))

    const namedMembers = (await Promise.all(namedMembersPromises)).filter(Boolean)
    res.send(namedMembers)
  }),
)

conversationRouter.get(
  '/:conversationId/messages',
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId
    const from = typeof req.query.from === 'string' ? req.query.from : ''
    const requestedLimit = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : NaN
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : MESSAGES_NUMBER_TO_LOAD
    const infos = jamid.getConversationInfos(accountId, conversationId)

    jamid.clearCache(accountId, conversationId)

    if (Object.keys(infos).length === 0) {
      res.status(HttpStatusCode.NotFound).send('No such conversation found')
      return
    }
    const messages = await jamid.getSwarmMessages(accountId, conversationId, from, limit)

    res.send(messages)
  }),
)

conversationRouter.post(
  '/:conversationId/messages',
  (req: Request<{ conversationId: string }, string, Record<string, unknown>>, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    const messageBody = typeof req.body.body === 'string' ? req.body.body : ''
    const replyTo = typeof req.body.replyTo === 'string' ? req.body.replyTo : undefined

    if (!messageBody) {
      res.status(HttpStatusCode.BadRequest).send('Missing body in request')
      return
    }

    jamid.sendConversationMessage(accountId, conversationId, messageBody, replyTo, SendMessageType.DEFAULT)

    res.sendStatus(HttpStatusCode.NoContent)
  },
)

conversationRouter.delete('/:conversationId', (req, res) => {
  jamid.removeConversation(res.locals.accountId, req.params.conversationId)
  res.sendStatus(HttpStatusCode.NoContent)
})

conversationRouter.post('/:conversationId/add-to-swarm', (req, res) => {
  const infos = jamid.getConversationInfos(res.locals.accountId, req.params.conversationId)
  // 0 represents private mode
  if (infos.mode === '0') {
    const newConversationId = jamid.startConversation(res.locals.accountId)
    const members = jamid.getConversationMembers(res.locals.accountId, req.params.conversationId)
    for (const member of members) {
      if (member.uri !== res.locals.accountId) {
        jamid.addConversationMember(res.locals.accountId, newConversationId, member.uri)
      }
    }
    for (const contactUri of req.body.contactUri) {
      jamid.addConversationMember(res.locals.accountId, newConversationId, contactUri)
    }
  } else {
    for (const contactUri of req.body.contactUri) {
      jamid.addConversationMember(res.locals.accountId, req.params.conversationId, contactUri)
    }
  }
  res.sendStatus(HttpStatusCode.Ok)
})

conversationRouter.post('/:conversationId/remove-from-swarm', (req, res) => {
  const accountId = res.locals.accountId
  const conversationId = req.params.conversationId
  const contactUri = req.body.contactUri

  const accountUri = jamid.getAccountDetails(accountId)['Account.username']
  const members = jamid.getConversationMembers(accountId, conversationId)

  const isAdmin = members.some(
    (member: { uri: string; role: string }) => member.uri === accountUri && member.role === 'admin',
  )
  const infos = jamid.getConversationInfos(accountId, conversationId)
  if (!isAdmin || infos.mode === '0') {
    res.status(HttpStatusCode.Forbidden).send('You must be an admin to remove members from the swarm group')
    return
  }
  jamid.removeConversationMember(accountId, conversationId, contactUri)
  res.sendStatus(HttpStatusCode.Ok)
})

conversationRouter.post(
  '/:conversationId/edit-message',
  (req: Request<{ conversationId: string }, string, Partial<NewMessageRequestBody>>, res) => {
    const body = req.body.body
    const messageId = req.body.messageId
    if (!body || !messageId) {
      res.status(HttpStatusCode.BadRequest).send('Missing body or messageId in request')
      return
    }

    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    jamid.sendConversationMessage(accountId, conversationId, body, messageId, SendMessageType.EDIT)
    res.sendStatus(HttpStatusCode.NoContent)
  },
)

conversationRouter.post(
  '/:conversationId/transfer-message/',
  asyncHandler(async (req, res) => {
    const accountId = res.locals.accountId
    const messageBody = req.body.messageBody
    const targetedConversations = req.body.targetedConversations
    const comment = req.body.comment

    if (!messageBody) {
      res.status(HttpStatusCode.BadRequest).send('Missing message in body')
      return
    }

    targetedConversations.forEach((targetConversationId: string) => {
      jamid.transferMessage(accountId, targetConversationId, messageBody)
      if (comment) {
        jamid.sendConversationMessage(accountId, targetConversationId, comment)
      }
    })

    res.sendStatus(HttpStatusCode.Ok)
  }),
)

conversationRouter.delete('/delete/:conversationId/:messageId', (req, res) => {
  jamid.deleteConversationMessage(res.locals.accountId, req.params.conversationId, req.params.messageId)
  res.sendStatus(HttpStatusCode.NoContent)
})

conversationRouter.get('/:conversationId/files', async (req, res) => {
  try {
    const files = await jamid.getAllFiles(res.locals.accountId, req.params.conversationId)
    res.send(files)
  } catch (e) {
    res.status(HttpStatusCode.InternalServerError).send('Error getting files')
  }
})
