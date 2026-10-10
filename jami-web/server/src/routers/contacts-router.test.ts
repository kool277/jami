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
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it, mock } from 'node:test'

import express from 'express'
import { Container } from 'typedi'

import { PresenceService } from '../services/PresenceService.js'

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
class MockJamid {}
const subscribe = mock.fn()
const unsubscribe = mock.fn()

let avatarPath: string
let avatarAvailable = true
let tempDirectory: string
let app: express.Express
const lookupAddress = mock.fn(async () => ({ address: 'bob', name: 'Bob' }))

before(async () => {
  tempDirectory = await mkdtemp(join(tmpdir(), 'jami-web-avatar-route-'))
  // The real cache lives under ~/.local/share/jami: the dot-segment must not
  // trip express's sendFile dotfiles handling, so reproduce it here.
  const dotDirectory = join(tempDirectory, '.cache')
  await mkdir(dotDirectory, { recursive: true })
  avatarPath = join(dotDirectory, 'avatar.png')
  await writeFile(avatarPath, pngBytes)

  Container.set(MockJamid, {
    getAccountDetails: () => ({ 'Account.username': 'alice' }),
    getContacts: () => [{ id: 'bob', username: 'Bob' }],
    getContactDetails: () => ({ id: 'bob', conversationId: 'conversation-id', added: '', confirmed: '' }),
    lookupAddress,
    removeContact: () => {},
  })
  Container.set(PresenceService, { subscribe, unsubscribe })
  mock.module('../jamid/jamid.js', {
    namedExports: {
      Jamid: MockJamid,
    },
  })
  mock.module('../middleware/auth.js', {
    namedExports: {
      authenticateToken: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.locals.accountId = 'account-id'
        next()
      },
      requireApiTokenScope: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    },
  })
  mock.module('../middleware/guest.js', {
    namedExports: {
      extendIfGuest: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
    },
  })
  mock.module('../utils/vCard.js', {
    namedExports: {
      getAvatar: async () => (avatarAvailable ? avatarPath : undefined),
      getDisplayName: async () => '',
    },
  })

  const contactsRouterModule = './contacts-router.js?avatar-route-test'
  const { contactsRouter } = await import(contactsRouterModule)
  app = express()
  app.use('/contacts', contactsRouter)
})

after(async () => {
  mock.restoreAll()
  Container.remove(MockJamid)
  Container.remove(PresenceService)
  await rm(tempDirectory, { recursive: true })
})

async function request(path: string, init?: RequestInit): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init)
  } finally {
    await closeServer(server)
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

describe('GET /contacts', () => {
  it('subscribes every listed contact to presence updates', async () => {
    const response = await request('/contacts')

    assert.equal(response.status, 200)
    assert.deepEqual(
      subscribe.mock.calls.map((call) => call.arguments),
      [['account-id', 'bob']],
    )
  })
})

describe('GET /contacts/:contactId', () => {
  it('looks up contact details with the account and default nameserver', async () => {
    const response = await request('/contacts/bob')

    assert.equal(response.status, 200)
    assert.deepEqual(lookupAddress.mock.calls.at(-1)?.arguments, ['bob', '', 'account-id'])
    assert.equal((await response.json()).username, 'Bob')
  })
})

describe('DELETE /contacts/:contactId', () => {
  it('stops tracking the removed contact presence', async () => {
    const response = await request('/contacts/bob', { method: 'DELETE' })

    assert.equal(response.status, 204)
    assert.deepEqual(
      unsubscribe.mock.calls.map((call) => call.arguments),
      [['account-id', 'bob']],
    )
  })
})

describe('GET /contacts/:contactUri/profile/picture', () => {
  it('serves cached avatars with the image MIME type inferred from the extension', async () => {
    const response = await request('/contacts/alice/profile/picture')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'image/png')
    assert.equal(response.headers.get('cache-control'), 'private, no-cache')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pngBytes)
  })

  it('returns a cacheable empty response when the contact has no avatar', async () => {
    avatarAvailable = false
    try {
      const response = await request('/contacts/alice/profile/picture')

      assert.equal(response.status, 204)
    } finally {
      avatarAvailable = true
    }
  })
})
