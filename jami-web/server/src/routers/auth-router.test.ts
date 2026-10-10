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

const removedPendingAccounts: string[] = []
const providedAuthentications: Array<{ accountId: string; credentials: string; scheme: string }> = []
const accountWrites: Array<{ username: string; value: string; authMethod: string; accountId: string }> = []
let daemonAccountIds: string[] = []
let jamsAccount: { password: string; accountId: string } | undefined
let nextJamsAccountId = 'jams-account-2'
const openIdJwtArguments: Array<{ email: string; userName: string; service: string }> = []
let openIdUserInfo: Record<string, unknown> | undefined
let profilePictureDownloadFails = false

class MockJamid {}
class MockAccounts {}
class MockAdminAccount {}
class MockOpenIdProviders {}

const jamid = {
  getLinkToken: () => undefined,
  addAccount: async (details: Record<string, string>) => ({
    accountId: details['Account.managerUri'] ? nextJamsAccountId : 'guest-account-1',
  }),
  getAccountIds: () => daemonAccountIds,
  provideAccountAuthentication: (accountId: string, credentials: string, scheme: string) => {
    providedAuthentications.push({ accountId, credentials, scheme })
    return true
  },
}

const accounts = {
  getPendingAccounts: () => ({}),
  addPendingAccount: () => undefined,
  removeAndDeletePendingAccount: (accountId: string) => {
    removedPendingAccounts.push(accountId)
  },
  set: (username: string, value: string, authMethod: string, accountId: string) => {
    accountWrites.push({ username, value, authMethod, accountId })
    if (authMethod === 'jams') {
      jamsAccount = { password: value, accountId }
    }
  },
  get: (_username: string, authMethod?: string) => (authMethod === 'jams' ? jamsAccount : undefined),
  getOpenIdAccount: () => ({ accountId: 'openid-account-1' }),
  save: () => undefined,
}

mock.module('../jamid/jamid.js', { namedExports: { Jamid: MockJamid } })
mock.module('../storage/accounts.js', { namedExports: { Accounts: MockAccounts } })
mock.module('../storage/admin-account.js', { namedExports: { AdminAccount: MockAdminAccount } })
mock.module('../storage/openid-providers.js', { namedExports: { OpenIdProviders: MockOpenIdProviders } })
mock.module('../utils/guests.js', { namedExports: { clearGuest: () => undefined, clearGuests: () => undefined } })
mock.module('../utils/electron.js', { namedExports: { isElectronMode: false } })
mock.module('../utils/jwt.js', {
  namedExports: {
    signJwt: async () => 'jwt',
    signJwtWithExpiration: async () => 'jwt',
    verifyJwt: async () => ({ payload: { accountId: 'account-1' } }),
  },
})
mock.module('../utils/password.js', {
  namedExports: { hashPassword: async (password: string) => password, verifyPassword: async () => true },
})
mock.module('../utils/openid.js', {
  namedExports: {
    exchangeCodeForToken: async () => ({
      // OAuth responses use this external snake_case field.
      // eslint-disable-next-line camelcase
      access_token: 'openid-access-token',
    }),
    exchangeTokenForUserInfo: async () => openIdUserInfo,
    getBase64Picture: async () => {
      if (profilePictureDownloadFails) {
        throw new Error('Profile picture download failed')
      }
      return undefined
    },
    getJwt: async (email: string, userName: string, service: string) => {
      openIdJwtArguments.push({ email, userName, service })
      return 'jwt'
    },
  },
})

let app: express.Express

before(async () => {
  Container.set(MockJamid, jamid)
  Container.set(MockAccounts, accounts)
  Container.set(MockAdminAccount, {
    getConfig: () => ({ guestAccessEnabled: true, jamsAuthEnabled: true, openIdAuthEnabled: true }),
    getJamsServerUrl: () => 'https://jams.example',
    getOpenIdProvidersNames: () => ['discord', 'linkedin'],
    isProviderActive: () => true,
  })
  Container.set(MockOpenIdProviders, {
    getProviders: () => [],
    getOpenIdProvidersNames: () => ['discord', 'linkedin'],
  })
  const authRouterModule = './auth-router.js?auth-router-test'
  const { authRouter } = await import(authRouterModule)
  app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
})

beforeEach(() => {
  removedPendingAccounts.length = 0
  providedAuthentications.length = 0
  accountWrites.length = 0
  daemonAccountIds = []
  jamsAccount = undefined
  nextJamsAccountId = 'jams-account-2'
  openIdJwtArguments.length = 0
  openIdUserInfo = undefined
  profilePictureDownloadFails = false
})

after(() => {
  mock.restoreAll()
  Container.remove(MockJamid)
  Container.remove(MockAccounts)
  Container.remove(MockAdminAccount)
  Container.remove(MockOpenIdProviders)
})

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    assert.ok(address && typeof address !== 'string')
    // A handler that never answers would otherwise hang the test run.
    return await fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, signal: AbortSignal.timeout(2000) })
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  }
}

describe('auth router device linking', () => {
  it('answers the cancellation of a pending link', async () => {
    const response = await request('/auth/link/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId: 'account-1' }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(removedPendingAccounts, ['account-1'])
  })

  it('answers an authentication attempt', async () => {
    const response = await request('/auth/link/authenticate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values: { accountId: 'account-1', password: '', scheme: 'password' } }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(providedAuthentications, [{ accountId: 'account-1', credentials: '', scheme: 'password' }])
  })
})

describe('auth router guest login', () => {
  it('registers the created guest account ID before issuing its token', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authMethod: 'guest' }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { accessToken: 'jwt' })
    assert.equal(accountWrites.length, 1)
    const accountWrite = accountWrites[0]!
    assert.deepEqual(
      {
        username: accountWrite.username,
        authMethod: accountWrite.authMethod,
        accountId: accountWrite.accountId,
      },
      {
        username: 'guest-account-1',
        authMethod: 'guest',
        accountId: 'guest-account-1',
      },
    )
    assert.equal(Number.isFinite(Number(accountWrite.value)), true)
  })
})

describe('auth router JAMS login', () => {
  it('recreates a stored account that is no longer available in the daemon', async () => {
    jamsAccount = { password: 'password', accountId: 'missing-jams-account' }

    const response = await request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ada', password: 'password', authMethod: 'jams' }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { accessToken: 'jwt' })
    assert.deepEqual(jamsAccount, { password: 'password', accountId: 'jams-account-2' })
  })
})

describe('auth router OpenID callbacks', () => {
  it('uses a Discord username when the profile has no name', async () => {
    openIdUserInfo = { id: 'discord-user-id', username: 'discord-user' }

    const response = await request('/auth/oauth/discord/callback?code=code', { redirect: 'manual' })

    assert.equal(response.status, 302)
    assert.deepEqual(openIdJwtArguments, [{ email: 'discord-user-id', userName: 'discord-user', service: 'discord' }])
  })

  it('completes login when the provider blocks profile picture downloads', async () => {
    openIdUserInfo = { id: 'linkedin-user-id', name: 'LinkedIn User', picture: 'https://media.licdn.com/profile' }
    profilePictureDownloadFails = true

    const response = await request('/auth/oauth/linkedin/callback?code=code', { redirect: 'manual' })

    assert.equal(response.status, 302)
    const redirectUrl = new URL(response.headers.get('location')!)
    assert.equal(redirectUrl.pathname, '/login')
    assert.equal(redirectUrl.searchParams.get('accessToken'), 'jwt')
  })
})
