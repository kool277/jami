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
import 'reflect-metadata'

import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { after, before, describe, it, mock } from 'node:test'

import express from 'express'

const router = express.Router()

const routerModules = [
  ['./routers/account-router.js', 'accountRouter'],
  ['./routers/admin-router.js', 'adminRouter'],
  ['./routers/auth-router.js', 'authRouter'],
  ['./routers/call-router.js', 'callRouter'],
  ['./routers/config.js', 'configRouter'],
  ['./routers/contacts-router.js', 'contactsRouter'],
  ['./routers/conversation-request-router.js', 'conversationRequestRouter'],
  ['./routers/conversation-router.js', 'conversationRouter'],
  ['./routers/data-transfer.js', 'dataTransferRouter'],
  ['./routers/default-moderators-router.js', 'defaultModeratorsRouter'],
  ['./routers/link-preview-router.js', 'linkPreviewRouter'],
  ['./routers/nameserver-router.js', 'nameserverRouter'],
  ['./routers/passkey-router.js', 'passkeyRouter'],
  ['./routers/token-router.js', 'tokenRouter'],
] as const

const websocketModules = [
  ['./websocket/chat-handler.js', 'bindChatCallbacks'],
  ['./websocket/chat-reactionadded-handler.js', 'bindReactionAddedCallBack'],
  ['./websocket/chat-reactionremoved-handler.js', 'bindReactionRemovedCallBack'],
  ['./websocket/load-more-messages-handler.js', 'bindLoadMoreMessagesCallBack'],
  ['./websocket/load-swarm-until-handler.js', 'bindLoadSwarmUntilCallback'],
  ['./websocket/message-status-handler.js', 'bindMessageStatusChangeCallbacks'],
  ['./websocket/webrtc-handler.js', 'bindWebRtcCallbacks'],
] as const

before(() => {
  for (const [specifier, exportName] of routerModules) {
    mock.module(specifier, { namedExports: { [exportName]: router } })
  }

  for (const [specifier, exportName] of websocketModules) {
    mock.module(specifier, { namedExports: { [exportName]: () => {} } })
  }
})

after(() => mock.restoreAll())

async function createApp(nodeEnv: 'development' | 'production', corsOrigins?: string) {
  const previousNodeEnv = process.env.NODE_ENV
  const previousCorsOrigins = process.env.CORS_ORIGINS
  process.env.NODE_ENV = nodeEnv
  if (corsOrigins === undefined) {
    delete process.env.CORS_ORIGINS
  } else {
    process.env.CORS_ORIGINS = corsOrigins
  }

  try {
    const { App } = await import(`./app.js?node-env=${nodeEnv}&cors-origins=${corsOrigins ?? 'unset'}`)
    return new App().app
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }

    if (previousCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS
    } else {
      process.env.CORS_ORIGINS = previousCorsOrigins
    }
  }
}

async function request(
  app: express.Express,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    return await fetch(`http://127.0.0.1:${address.port}${path}`, options)
  } finally {
    await closeServer(server)
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

describe('App security middleware', () => {
  it('allows configured, trimmed origins and rejects other origins', async () => {
    const app = await createApp('production', ' https://chat.example.com, https://admin.example.com ')

    for (const origin of ['https://chat.example.com', 'https://admin.example.com']) {
      const response = await request(app, '/api/missing', { headers: { Origin: origin } })
      assert.equal(response.headers.get('access-control-allow-origin'), origin)
    }

    const rejectedResponse = await request(app, '/api/missing', { headers: { Origin: 'https://evil.example.com' } })
    assert.equal(rejectedResponse.headers.get('access-control-allow-origin'), null)
  })

  it('allows any localhost dev port and rejects non-loopback origins', async () => {
    const app = await createApp('development')

    // Vite falls back to 3001, 3002, ... when 3000 is taken; dev defaults
    // must accept any loopback port, not just a hardcoded one.
    for (const origin of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'https://localhost:5173',
    ]) {
      const response = await request(app, '/api/missing', { headers: { Origin: origin } })
      assert.equal(response.headers.get('access-control-allow-origin'), origin)
    }

    for (const origin of ['http://192.168.1.10:3000', 'https://chat.example.com']) {
      const rejectedResponse = await request(app, '/api/missing', { headers: { Origin: origin } })
      assert.equal(rejectedResponse.headers.get('access-control-allow-origin'), null)
    }
  })

  it('rejects browser origins in production without an allowlist while allowing requests without Origin', async () => {
    const app = await createApp('production')

    const rejectedResponse = await request(app, '/api/missing', { headers: { Origin: 'https://chat.example.com' } })
    assert.equal(rejectedResponse.headers.get('access-control-allow-origin'), null)

    const sameOriginResponse = await request(app, '/api/missing')
    assert.equal(sameOriginResponse.status, 200)
    assert.equal(sameOriginResponse.headers.get('access-control-allow-origin'), null)
  })

  it('sets CORS headers only for allowed OPTIONS preflight requests', async () => {
    const app = await createApp('production', 'https://chat.example.com')

    const allowedResponse = await request(app, '/api/missing', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://chat.example.com',
        'Access-Control-Request-Method': 'GET',
      },
    })
    assert.equal(allowedResponse.status, 204)
    assert.equal(allowedResponse.headers.get('access-control-allow-origin'), 'https://chat.example.com')
    assert.match(allowedResponse.headers.get('access-control-allow-methods') ?? '', /\bGET\b/)

    const rejectedResponse = await request(app, '/api/missing', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example.com',
        'Access-Control-Request-Method': 'GET',
      },
    })
    assert.equal(rejectedResponse.status, 404)
    assert.equal(rejectedResponse.headers.get('access-control-allow-origin'), null)
    assert.equal(rejectedResponse.headers.get('access-control-allow-methods'), null)
  })

  it('emits the intended content security policy', async () => {
    const app = await createApp('production')

    const response = await request(app, '/api/missing')
    const contentSecurityPolicy = response.headers.get('content-security-policy')
    assert.ok(contentSecurityPolicy)
    assert.match(contentSecurityPolicy, /default-src 'self'/)
    assert.match(contentSecurityPolicy, /img-src 'self' data: blob: https:/)
    assert.match(contentSecurityPolicy, /script-src 'self'/)
    assert.match(contentSecurityPolicy, /style-src 'self' 'unsafe-inline'/)
    assert.match(contentSecurityPolicy, /connect-src 'self' ws: wss:/)
    assert.doesNotMatch(contentSecurityPolicy, /upgrade-insecure-requests/)
  })
})
