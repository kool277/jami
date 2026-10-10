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
import { after, before, beforeEach, describe, it, mock } from 'node:test'

import express from 'express'
import { Container } from 'typedi'

const accountId = 'account-id'
const createTokenCalls: Array<{ accountId: string; name: string; scopes: string[]; expiresInSeconds?: number }> = []

class MockApiTokenStore {}

const tokenStore = {
  createToken: (id: string, name: string, scopes: string[], expiresInSeconds?: number) => {
    createTokenCalls.push({ accountId: id, name, scopes, expiresInSeconds })
    return {
      token: 'jm_sk_secret',
      info: { id: 'token-id', prefix: 'jm_sk_secret', name, scopes, createdAt: '2026-01-01T00:00:00.000Z' },
    }
  },
  listTokens: () => [],
  revokeToken: () => true,
  save: async () => {},
}

mock.module('../storage/api-tokens.js', {
  namedExports: {
    ApiTokenStore: MockApiTokenStore,
    MAX_API_TOKEN_LIFETIME_SECONDS: 5 * 365 * 24 * 60 * 60,
    MAX_API_TOKEN_NAME_LENGTH: 100,
  },
})
mock.module('../middleware/auth.js', {
  namedExports: {
    authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.locals.accountId = accountId
      res.locals.credentialKind = req.header('x-credential-kind') ?? 'session'
      next()
    },
    requireSessionAuthentication: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (res.locals.credentialKind !== 'session') {
        res.status(403).send('API tokens cannot manage API tokens')
        return
      }
      next()
    },
  },
})

let app: express.Express

before(async () => {
  Container.set(MockApiTokenStore, tokenStore)
  const tokenRouterModule = './token-router.js?token-router-test'
  const { tokenRouter } = await import(tokenRouterModule)
  app = express()
  app.use(express.json())
  app.use('/tokens', tokenRouter)
})

beforeEach(() => {
  createTokenCalls.length = 0
})

after(() => {
  mock.restoreAll()
  Container.remove(MockApiTokenStore)
})

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init)
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

describe('token router', () => {
  it('rejects API token credentials from creating tokens', async () => {
    const response = await request('/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-credential-kind': 'apiToken' },
      body: JSON.stringify({ name: 'integration', scopes: ['account:read'] }),
    })

    assert.equal(response.status, 403)
    assert.equal(createTokenCalls.length, 0)
  })

  it('creates a session-managed token with validated lifetime and scopes', async () => {
    const response = await request('/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: ' integration ', scopes: ['account:read'], expiresInSeconds: 3600 }),
    })

    assert.equal(response.status, 201)
    assert.deepEqual(createTokenCalls, [
      { accountId, name: 'integration', scopes: ['account:read'], expiresInSeconds: 3600 },
    ])
  })

  it('rejects unsupported scopes', async () => {
    const response = await request('/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'integration', scopes: ['admin:write'] }),
    })

    assert.equal(response.status, 400)
    assert.equal(createTokenCalls.length, 0)
  })

  it('rejects an empty scope list instead of minting an unrestricted token', async () => {
    const response = await request('/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'integration', scopes: [] }),
    })

    assert.equal(response.status, 400)
    assert.equal(createTokenCalls.length, 0)
  })
})
