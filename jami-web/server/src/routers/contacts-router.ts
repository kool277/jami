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
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'
import { PresenceService } from '../services/PresenceService.js'
import { addContactAndResolveConversation } from '../utils/add-contact.js'
import { getAvatar, getDisplayName } from '../utils/vCard.js'
const jamid = Container.get(Jamid)
const presenceService = Container.get(PresenceService)
export const contactsRouter = Router()

contactsRouter.use(authenticateToken)
contactsRouter.use(extendIfGuest)
contactsRouter.use(requireApiTokenScope('contacts'))

contactsRouter.get('/', async (_req, res) => {
  const contacts = jamid.getContacts(res.locals.accountId)
  for (const contact of contacts) {
    presenceService.subscribe(res.locals.accountId, contact.id)
    contact.displayName = await getDisplayName(res.locals.accountId, contact.id)
    try {
      const username = await jamid.lookupAddress(contact.id, '', res.locals.accountId)
      contact.username = username.name
    } catch (e) {
      console.error(e)
    }
  }
  res.send(contacts)
})

contactsRouter.get('/:contactId', async (req, res) => {
  const contactDetails = jamid.getContactDetails(res.locals.accountId, req.params.contactId)

  if (contactDetails.id === undefined) {
    res.status(HttpStatusCode.NotFound).send('No such contact found')
    return
  }

  try {
    const contactUsername = await jamid.lookupAddress(contactDetails.id, '', res.locals.accountId)
    if (contactUsername.address === contactDetails.id) {
      contactDetails.username = contactUsername.name
    }
    contactDetails.displayName = await getDisplayName(res.locals.accountId, contactDetails.id)
    if (Object.keys(contactDetails).length === 0) {
      res.status(HttpStatusCode.NotFound).send('No such contact found')
      return
    }
    res.send(contactDetails)
  } catch (e) {
    res.status(HttpStatusCode.InternalServerError)
  }
})

contactsRouter.put('/:contactId', async (req, res) => {
  const contactDetails = await addContactAndResolveConversation(jamid, res.locals.accountId, req.params.contactId)
  if (!contactDetails) {
    res.status(HttpStatusCode.NotFound).send('No such contact found')
    return
  }

  res.send(contactDetails)
})

contactsRouter.delete('/:contactId', (req, res) => {
  jamid.removeContact(res.locals.accountId, req.params.contactId)
  // Mirror the daemon clients: presence tracking follows the contact lifecycle
  presenceService.unsubscribe(res.locals.accountId, req.params.contactId)
  res.sendStatus(HttpStatusCode.NoContent)
})

contactsRouter.post('/:contactId/block', (req, res) => {
  jamid.blockContact(res.locals.accountId, req.params.contactId)
  res.sendStatus(HttpStatusCode.NoContent)
})

contactsRouter.get('/:contactUri/profile/picture', async (req, res) => {
  const accountId = res.locals.accountId
  const contactUri = req.params.contactUri

  const accountUri = jamid.getAccountDetails(accountId)['Account.username']
  const path = await getAvatar(accountId, contactUri, contactUri === accountUri)
  if (path) {
    // The avatar cache lives under ~/.local/share/jami; sendFile refuses
    // paths with dot-segments by default, which would turn every avatar
    // into a 500 despite the file existing.
    res.setHeader('Cache-Control', 'private, no-cache')
    res.sendFile(path, { dotfiles: 'allow' })
    return
  }
  // A missing avatar is a normal state. A successful empty response lets clients cache it.
  res.sendStatus(HttpStatusCode.NoContent)
})
