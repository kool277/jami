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
import { createServer, type Server } from 'node:http'
import { after, before, beforeEach, describe, it, mock } from 'node:test'

import express from 'express'
import { Container } from 'typedi'

class MockJamid {}
class MockConversationService {}

let cacheAvatarShouldFail = false
let events: string[] = []
const cacheAvatar = mock.fn(async () => {
  events.push('cache-avatar')
  if (cacheAvatarShouldFail) {
    throw new Error('cache unavailable')
  }
})
const acceptConversationRequest = mock.fn(async () => {
  events.push('accept')
})
let app: express.Express

before(async () => {
  Container.set(MockJamid, {
    acceptConversationRequest,
    getConversationRequests: () => [
      {
        id: 'conversation-id',
        from: 'contact-uri',
        avatar: '/9j/4AAQSkY=',
      },
    ],
  })
  Container.set(MockConversationService, {
    createConversationSummary: async () => ({
      id: 'conversation-id',
      membersNames: [],
    }),
  })
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
  mock.module('../services/ConversationService.js', {
    namedExports: {
      ConversationService: MockConversationService,
    },
  })
  mock.module('../utils/vCard.js', {
    namedExports: {
      cacheAvatar,
    },
  })

  const conversationRequestRouterModule = './conversation-request-router.js?avatar-cache-test'
  const { conversationRequestRouter } = await import(conversationRequestRouterModule)
  app = express()
  app.use('/conversation-requests', conversationRequestRouter)
})

beforeEach(() => {
  cacheAvatarShouldFail = false
  events = []
  cacheAvatar.mock.resetCalls()
  acceptConversationRequest.mock.resetCalls()
})

after(() => {
  mock.restoreAll()
  Container.remove(MockJamid)
  Container.remove(MockConversationService)
})

describe('POST /conversation-requests/:conversationId', () => {
  it('caches the request avatar after accepting the conversation', async () => {
    const response = await request('/conversation-requests/conversation-id', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(cacheAvatar.mock.callCount(), 1)
    assert.deepEqual(cacheAvatar.mock.calls[0].arguments, ['account-id', 'contact-uri', '/9j/4AAQSkY='])
    assert.deepEqual(events, ['accept', 'cache-avatar'])
  })

  it('accepts the conversation when caching the avatar fails', async () => {
    cacheAvatarShouldFail = true
    const consoleError = mock.method(console, 'error', () => undefined)

    try {
      const response = await request('/conversation-requests/conversation-id', { method: 'POST' })

      assert.equal(response.status, 200)
      assert.equal(acceptConversationRequest.mock.callCount(), 1)
      assert.equal(consoleError.mock.callCount(), 1)
    } finally {
      consoleError.mock.restore()
    }
  })
})

async function request(path: string, init: RequestInit): Promise<Response> {
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
