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
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { after, before, describe, it, mock } from 'node:test'

import express from 'express'
import { Container } from 'typedi'

import { PresenceService } from '../services/PresenceService.js'

const getStatuses = mock.fn((_accountId: string) => ({ bob: 1, carol: 0 }))

let app: express.Express

before(async () => {
  Container.set(PresenceService, { getStatuses })
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

  const presenceRouterModule = './presence-router.js?presence-route-test'
  const { presenceRouter } = await import(presenceRouterModule)
  app = express()
  app.use('/presence', presenceRouter)
})

after(() => {
  mock.restoreAll()
  Container.remove(PresenceService)
})

async function request(path: string): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    return await fetch(`http://127.0.0.1:${address.port}${path}`)
  } finally {
    await closeServer(server)
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

describe('GET /presence', () => {
  it('returns the last known status of every buddy of the account', async () => {
    const response = await request('/presence')

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { bob: 1, carol: 0 })
    assert.deepEqual(
      getStatuses.mock.calls.map((call) => call.arguments),
      [['account-id']],
    )
  })
})
