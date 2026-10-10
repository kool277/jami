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
import { createServer } from 'node:http'
import { after, before, describe, it, mock } from 'node:test'

import express from 'express'
import { Container } from 'typedi'

class MockJamid {}
class MockContactService {}
class MockConversationService {}

const getConversationInfos = mock.fn(() => ({
  avatar: '/9j/4AAQSkY=',
  mode: '1',
  title: 'Design team',
}))
let app: express.Express

before(async () => {
  Container.set(MockJamid, { getConversationInfos })
  Container.set(MockContactService, {})
  Container.set(MockConversationService, {})
  mock.module('../jamid/jamid.js', { namedExports: { Jamid: MockJamid } })
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
  mock.module('../services/ContactService.js', { namedExports: { ContactService: MockContactService } })
  mock.module('../services/ConversationService.js', { namedExports: { ConversationService: MockConversationService } })

  const conversationRouterModule = './conversation-router.js?conversation-infos-avatar-test'
  const { conversationRouter } = await import(conversationRouterModule)
  app = express()
  app.use('/conversations', conversationRouter)
})

after(() => {
  mock.restoreAll()
  Container.remove(MockJamid)
  Container.remove(MockContactService)
  Container.remove(MockConversationService)
})

describe('GET /conversations/:conversationId/infos', () => {
  it('returns group avatars as data URLs', async () => {
    const response = await request('/conversations/conversation-id/infos')

    assert.equal(response.status, 200)
    assert.equal((await response.json()).avatar, 'data:image/jpeg;base64,/9j/4AAQSkY=')
  })
})

async function request(path: string): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    return await fetch(`http://127.0.0.1:${address.port}${path}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}
