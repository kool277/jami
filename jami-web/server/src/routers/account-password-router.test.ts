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

const accountId = 'account-id'
const credential = { accountId, password: 'hashed-current-password' }
let hasLocalCredential = true
let saveShouldFail = false
let saveCalls = 0
let sessionsInvalidatedFor: string[] = []
let revokedTokensFor: string[] = []
let closedSocketsFor: string[] = []
let tokenSaveCalls = 0

class MockJamid {}
class MockAccounts {}
class MockApiTokenStore {}
class MockWebSocketServer {}

const accounts = {
  getLocalByAccountId: (id: string) => (hasLocalCredential && id === accountId ? credential : undefined),
  updateLocalPassword: (id: string, password: string) => {
    if (id !== accountId) {
      return false
    }
    credential.password = password
    return true
  },
  setSessionsInvalidAfter: (id: string) => {
    sessionsInvalidatedFor.push(id)
  },
  save: async () => {
    saveCalls += 1
    if (saveShouldFail) {
      throw new Error('Unable to persist account credentials')
    }
  },
}

const tokenStore = {
  revokeAllTokens: (id: string) => {
    revokedTokensFor.push(id)
    return true
  },
  save: async () => {
    tokenSaveCalls += 1
  },
}

const webSocketServer = {
  closeAccountSockets: (id: string) => {
    closedSocketsFor.push(id)
  },
}

mock.module('../jamid/jamid.js', { namedExports: { Jamid: MockJamid } })
mock.module('../storage/accounts.js', { namedExports: { Accounts: MockAccounts } })
mock.module('../storage/api-tokens.js', { namedExports: { ApiTokenStore: MockApiTokenStore } })
mock.module('../websocket/websocket-server.js', { namedExports: { WebSocketServer: MockWebSocketServer } })
mock.module('../middleware/auth.js', {
  namedExports: {
    authenticateToken: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.locals.accountId = accountId
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
mock.module('../utils/password.js', {
  namedExports: {
    hashPassword: async () => 'hashed-new-password',
    verifyPassword: async (hashedPassword: string, password: string) =>
      hashedPassword === 'hashed-current-password' && password === 'CurrentPass1!',
  },
})
mock.module('../utils/vCard.js', { namedExports: { clearAvatarCache: async () => {} } })

let app: express.Express

before(async () => {
  Container.set(MockJamid, {})
  Container.set(MockAccounts, accounts)
  Container.set(MockApiTokenStore, tokenStore)
  Container.set(MockWebSocketServer, webSocketServer)
  const accountRouterModule = './account-router.js?password-route-test'
  const { accountRouter } = await import(accountRouterModule)

  app = express()
  app.use(express.json())
  app.use('/account', accountRouter)
})

beforeEach(() => {
  credential.password = 'hashed-current-password'
  hasLocalCredential = true
  saveShouldFail = false
  saveCalls = 0
  sessionsInvalidatedFor = []
  revokedTokensFor = []
  closedSocketsFor = []
  tokenSaveCalls = 0
})

after(() => {
  mock.restoreAll()
  Container.remove(MockJamid)
  Container.remove(MockAccounts)
  Container.remove(MockApiTokenStore)
  Container.remove(MockWebSocketServer)
})

async function request(body: unknown): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    return await fetch(`http://127.0.0.1:${address.port}/account/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } finally {
    await closeServer(server)
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

describe('PATCH /account/password', () => {
  it('replaces and persists the local credential after verifying the current password', async () => {
    const response = await request({ currentPassword: 'CurrentPass1!', newPassword: 'NewPassword1!' })

    assert.equal(response.status, 204)
    assert.equal(credential.password, 'hashed-new-password')
    assert.equal(saveCalls, 1)
  })

  it('invalidates existing sessions, API tokens, and sockets so old credentials cannot be reused', async () => {
    const response = await request({ currentPassword: 'CurrentPass1!', newPassword: 'NewPassword1!' })

    assert.equal(response.status, 204)
    assert.deepEqual(sessionsInvalidatedFor, [accountId])
    assert.deepEqual(revokedTokensFor, [accountId])
    assert.deepEqual(closedSocketsFor, [accountId])
    assert.equal(tokenSaveCalls, 1)
  })

  it('keeps sessions and tokens untouched when the current password is wrong', async () => {
    const response = await request({ currentPassword: 'WrongPassword1!', newPassword: 'NewPassword1!' })

    assert.equal(response.status, 409)
    assert.deepEqual(sessionsInvalidatedFor, [])
    assert.deepEqual(revokedTokensFor, [])
    assert.deepEqual(closedSocketsFor, [])
  })

  it('rejects an incorrect current password without modifying the credential', async () => {
    const response = await request({ currentPassword: 'WrongPassword1!', newPassword: 'NewPassword1!' })

    assert.equal(response.status, 409)
    assert.equal(credential.password, 'hashed-current-password')
    assert.equal(saveCalls, 0)
  })

  it('rejects password changes for accounts without a local credential', async () => {
    hasLocalCredential = false
    const response = await request({ currentPassword: 'CurrentPass1!', newPassword: 'NewPassword1!' })

    assert.equal(response.status, 403)
    assert.equal(credential.password, 'hashed-current-password')
    assert.equal(saveCalls, 0)
  })

  it('rejects malformed, short, and unchanged passwords before modifying the credential', async () => {
    for (const body of [
      {},
      { currentPassword: 'CurrentPass1!', newPassword: 'short' },
      { currentPassword: 'CurrentPass1!', newPassword: 'CurrentPass1!' },
    ]) {
      const response = await request(body)
      assert.ok([400, 422].includes(response.status))
      assert.equal(credential.password, 'hashed-current-password')
      assert.equal(saveCalls, 0)
    }
  })

  it('restores the previous credential when persistence fails', async () => {
    saveShouldFail = true
    const response = await request({ currentPassword: 'CurrentPass1!', newPassword: 'NewPassword1!' })

    assert.equal(response.status, 500)
    assert.equal(credential.password, 'hashed-current-password')
    assert.equal(saveCalls, 1)
    assert.deepEqual(revokedTokensFor, [])
    assert.deepEqual(closedSocketsFor, [])
  })
})
