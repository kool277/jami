/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import cors from 'cors'
import express from 'express'
import { WebSocket, WebSocketServer as WsServer } from 'ws'

const mockApiTokenScopes = [
  'conversations:read',
  'conversations:write',
  'contacts:read',
  'contacts:write',
  'calls:read',
  'calls:write',
  'files:read',
  'files:write',
  'account:read',
  'account:write',
] as const

type MockApiTokenScope = (typeof mockApiTokenScopes)[number]

interface MockApiToken {
  id: string
  prefix: string
  name: string
  scopes: MockApiTokenScope[]
  createdAt: string
  expiresAt?: string
}

interface MockServerState {
  isSetupComplete: boolean
  lastWizardState: string | undefined
  adminPassword: string | undefined
  config: {
    localAuthEnabled: boolean
    jamsAuthEnabled: boolean
    guestAccessEnabled: boolean
    openIdAuthEnabled: boolean
    noLocalMediaEnabled: boolean
    conferenceResolution: '720p' | '1080p' | '1440p'
    uploadPath: string
    jamsUrl?: string
  }
  users: Record<string, { password: string; accountId: string }>
  userTokens: Record<string, string>
  apiTokens: Record<string, MockApiToken[]>
  adminPasskeys: { credentialId: string; name: string; createdAt: string }[]
  userPasskeys: Record<string, { credentialId: string; name: string; createdAt: string }[]>
  autoDownloadLimit: number
}

const defaultState: MockServerState = {
  isSetupComplete: false,
  lastWizardState: undefined,
  adminPassword: undefined,
  config: {
    localAuthEnabled: true,
    jamsAuthEnabled: false,
    guestAccessEnabled: false,
    openIdAuthEnabled: false,
    noLocalMediaEnabled: true,
    conferenceResolution: '720p',
    uploadPath: '/tmp/jami-uploads',
  },
  users: {},
  userTokens: {},
  apiTokens: {},
  adminPasskeys: [],
  userPasskeys: {},
  autoDownloadLimit: 0,
}

/**
 * Default state used when starting the mock server in standalone (development) mode.
 * Admin is pre-configured so the app goes straight to the login page.
 * Default credentials:
 *   Admin password : AdminPass123!
 *   User           : testuser / Test1234!
 */
const standaloneInitialState: Partial<MockServerState> = {
  isSetupComplete: true,
  lastWizardState: 'complete',
  adminPassword: 'AdminPass123!',
  users: {
    testuser: { password: 'Test1234!', accountId: 'acc-testuser' },
  },
}

function getAuthenticatedUsername(req: express.Request, state: MockServerState): string | undefined {
  const token = req.get('authorization')?.replace(/^Bearer\s+/, '')
  return token ? state.userTokens[token] : undefined
}

const mockOAuthProviders = [
  { name: 'google', isActive: false, displayName: 'Google' },
  { name: 'github', isActive: false, displayName: 'GitHub' },
]

/** Accounts the name server knows about, keyed by registered name. */
const registeredAddresses: Record<string, string> = {
  bob: 'contact-bob-uri',
  dana: '260d9aaee80c84ffda86bdc579a0be8d07a70b65',
}

const conversationFixtures = [
  { id: 'conv-1', title: '', mode: '0', membersNames: ['Bob'], body: 'Hello Alice!', unreadFor: ['alice'] },
  { id: 'conv-2', title: '', mode: '0', membersNames: ['Casey'], body: 'See you tomorrow.', unreadFor: ['bob'] },
  {
    id: 'conv-3',
    title: 'Weekend plans',
    mode: '1',
    membersNames: ['Alice', 'Bob', 'Casey'],
    body: 'I booked the table for Saturday.',
    unreadFor: ['alice', 'bob'],
  },
  { id: 'conv-4', title: '', mode: '0', membersNames: ['Drew'], body: 'Thanks for the update.', unreadFor: [] },
  {
    id: 'conv-5',
    title: 'Book club',
    mode: '1',
    membersNames: ['Alice', 'Bob', 'Drew', 'Emery'],
    body: 'Our next pick is ready.',
    unreadFor: ['alice'],
  },
  { id: 'conv-6', title: '', mode: '0', membersNames: ['Emery'], body: 'Can you review this?', unreadFor: ['bob'] },
  {
    id: 'conv-7',
    title: 'Project North',
    mode: '1',
    membersNames: ['Alice', 'Bob', 'Finley'],
    body: 'The release notes are published.',
    unreadFor: [],
  },
  {
    id: 'conv-8',
    title: '',
    mode: '0',
    membersNames: ['Finley'],
    body: 'Quick question for you.',
    unreadFor: ['alice', 'bob'],
  },
  {
    id: 'conv-9',
    title: 'Family chat',
    mode: '1',
    membersNames: ['Alice', 'Bob', 'Gale'],
    body: 'Photos from the weekend are up.',
    unreadFor: ['bob'],
  },
  { id: 'conv-10', title: '', mode: '0', membersNames: ['Gale'], body: 'Let us catch up soon.', unreadFor: ['alice'] },
  {
    id: 'conv-11',
    title: 'Study group',
    mode: '1',
    membersNames: ['Alice', 'Bob', 'Harper'],
    body: 'The notes are in the shared folder.',
    unreadFor: [],
  },
]

export function createMockServer(initialState: Partial<MockServerState> = {}): {
  app: express.Express
  server: Server
  state: MockServerState
  wsClients: Set<WebSocket>
} {
  const state: MockServerState = { ...defaultState, ...initialState }
  /** Contacts invited during a test run, exposed through `/__invited-contacts`. */
  const invitedContacts: { contactId: string; conversationId: string }[] = []
  const wsClients = new Set<WebSocket>()
  const app = express()

  app.use(cors())
  app.use(express.json())

  const api = express.Router()
  app.use('/api', api)

  // --- Admin routes ---

  api.get('/admin/check', (_req, res) => {
    res.json({ isSetupComplete: state.isSetupComplete, electronMode: false })
  })

  api.get('/admin/admin-wizard-state', (_req, res) => {
    res.json({ lastWizardState: state.lastWizardState })
  })

  api.post('/admin/create', (req, res) => {
    const { password } = req.body
    if (state.isSetupComplete) {
      res.status(403).send('Admin account already exists')
      return
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).send('Password must be at least 8 characters long')
      return
    }
    state.adminPassword = password
    state.isSetupComplete = true
    state.lastWizardState = 'ns' // After account creation, next step is name server
    res.json({ accessToken: 'mock-admin-token-' + Date.now() })
  })

  api.post('/admin/login', (req, res) => {
    const { password } = req.body
    if (!password) {
      res.status(400).send('Missing password in body')
      return
    }
    if (!state.adminPassword) {
      res.status(500).send('Admin password not found')
      return
    }
    if (password !== state.adminPassword) {
      res.status(401).send('Incorrect password')
      return
    }
    res.json({ accessToken: 'mock-admin-token-' + Date.now() })
  })

  api.get('/admin/config', (_req, res) => {
    res.json(state.config)
  })

  api.patch('/admin/config', (req, res) => {
    Object.assign(state.config, req.body)
    res.sendStatus(200)
  })

  api.post('/admin/admin-wizard-state', (req, res) => {
    state.lastWizardState = req.body.state
    res.sendStatus(200)
  })

  api.get('/admin/is-token-valid', (_req, res) => {
    // Accept any token for mock purposes
    res.sendStatus(200)
  })

  // Admin passkey availability
  api.get('/admin/passkey/available', (_req, res) => {
    res.json({ available: state.adminPasskeys.length > 0 })
  })

  // Admin passkey login/options — returns mock options (WebAuthn ceremony can't run in mock)
  api.post('/admin/passkey/login/options', (_req, res) => {
    if (state.adminPasskeys.length === 0) {
      res.status(404).send('No passkeys registered for admin')
      return
    }
    res.json({
      challenge: 'mock-admin-challenge',
      challengeKey: 'mock-admin-challenge-key',
      rpId: 'localhost',
      allowCredentials: state.adminPasskeys.map((pk) => ({ id: pk.credentialId })),
    })
  })

  // Admin passkey login/verify — always fails in mock (no real WebAuthn)
  api.post('/admin/passkey/login/verify', (_req, res) => {
    res.status(401).send('WebAuthn not available in mock')
  })

  // Admin passkey credentials (authenticated)
  api.get('/admin/passkey/credentials', (_req, res) => {
    res.json(state.adminPasskeys)
  })

  // Admin passkey register/options
  api.post('/admin/passkey/register/options', (_req, res) => {
    res.json({ challenge: 'mock-reg-challenge', rpId: 'localhost', rp: { name: 'Jami Web' } })
  })

  // Admin passkey register/verify — always fails in mock
  api.post('/admin/passkey/register/verify', (_req, res) => {
    res.status(400).send('WebAuthn not available in mock')
  })

  // Admin passkey delete
  api.delete('/admin/passkey/credentials/:credentialId', (req, res) => {
    const idx = state.adminPasskeys.findIndex((pk) => pk.credentialId === req.params.credentialId)
    if (idx === -1) {
      res.status(404).send('Credential not found')
      return
    }
    state.adminPasskeys.splice(idx, 1)
    res.sendStatus(204)
  })

  // --- User passkey endpoints ---

  // User passkey login/options
  api.post('/passkey/login/options', (_req, res) => {
    res.json({
      challenge: 'mock-user-challenge',
      challengeKey: 'mock-user-challenge-key',
      rpId: 'localhost',
      allowCredentials: [],
    })
  })

  // User passkey login/verify — always fails in mock
  api.post('/passkey/login/verify', (_req, res) => {
    res.status(401).send('WebAuthn not available in mock')
  })

  // User passkey credentials (authenticated)
  api.get('/passkey/credentials', (_req, res) => {
    const userPasskeys = state.userPasskeys['testuser'] ?? []
    res.json(userPasskeys)
  })

  // User passkey register/options
  api.post('/passkey/register/options', (_req, res) => {
    res.json({ challenge: 'mock-reg-challenge', rpId: 'localhost', rp: { name: 'Jami Web' } })
  })

  // User passkey register/verify — always fails in mock
  api.post('/passkey/register/verify', (_req, res) => {
    res.status(400).send('WebAuthn not available in mock')
  })

  // User passkey delete
  api.delete('/passkey/credentials/:credentialId', (_req, res) => {
    res.sendStatus(204)
  })

  api.get('/admin/nameserver', (_req, res) => {
    res.send('')
  })

  api.head('/admin/nameserver/username/:username', (req, res) => {
    res.sendStatus(state.users[req.params.username] ? 200 : 404)
  })

  api.get('/admin/accounts', (_req, res) => {
    res.json(
      Object.entries(state.users).map(([username, account]) => ({
        username,
        accountUri: username,
        auth: 'local',
        storage: 0,
        accountId: account.accountId,
      })),
    )
  })

  api.post('/admin/accounts', (req, res) => {
    const { username, password } = req.body
    if (typeof username !== 'string' || typeof password !== 'string' || password.length < 8) {
      res.status(400).send('Invalid account')
      return
    }
    if (state.users[username]) {
      res.status(409).send('Username already exists locally')
      return
    }
    const accountId = `acc-${randomUUID()}`
    state.users[username] = { accountId, password }
    res.status(201).json({ accountId })
  })

  api.patch('/admin/accounts/:accountId/password', (req, res) => {
    const account = Object.values(state.users).find((user) => user.accountId === req.params.accountId)
    if (!account || typeof req.body.password !== 'string' || req.body.password.length < 8) {
      res.status(400).send('Invalid account password')
      return
    }
    account.password = req.body.password
    res.sendStatus(204)
  })

  api.delete('/admin/accounts', (req, res) => {
    if (!Array.isArray(req.body)) {
      res.status(400).send('Invalid accounts payload')
      return
    }
    for (const account of req.body) {
      delete state.users[account.username]
    }
    res.sendStatus(200)
  })

  api.get('/admin/oauth/providers', (_req, res) => {
    res.json(mockOAuthProviders)
  })

  api.get('/admin/oauth/provider/:name', (req, res) => {
    const provider = mockOAuthProviders.find((item) => item.name === req.params.name)
    if (!provider) {
      res.status(404).send('Provider not found')
      return
    }

    res.json({
      clientId: '',
      isActive: provider.isActive,
      redirectUri: `http://localhost:5002/api/auth/oauth/${provider.name}/callback`,
      documentation: 'https://example.com/oauth-docs',
      displayName: provider.displayName,
      icon: '',
    })
  })

  api.patch('/admin/oauth/provider/:name', (req, res) => {
    const provider = mockOAuthProviders.find((item) => item.name === req.params.name)
    if (!provider) {
      res.status(404).send('Provider not found')
      return
    }

    if (req.body.isActive !== undefined) {
      provider.isActive = req.body.isActive
    }
    res.sendStatus(200)
  })

  // --- JAMS URL routes ---

  api.get('/admin/jams-url', (_req, res) => {
    if (!state.config.jamsUrl) {
      res.status(204).send('JAMS server URL is not set')
      return
    }
    res.send(state.config.jamsUrl)
  })

  api.get('/data/auto-download-limit', (_req, res) => {
    res.json({ limit: state.autoDownloadLimit })
  })

  api.get('/data/conference-resolution', (_req, res) => {
    res.json({ resolution: state.config.conferenceResolution })
  })

  api.post('/admin/auto-download-limit', (req, res) => {
    const limit = req.body.limit
    if (limit === undefined || limit < 0) {
      res.status(400).send('Invalid limit')
      return
    }
    state.autoDownloadLimit = limit
    res.sendStatus(200)
  })

  api.post('/admin/conference-resolution', (req, res) => {
    const resolution = req.body.resolution
    if (!['720p', '1080p', '1440p'].includes(resolution)) {
      res.status(400).send('Invalid conference resolution')
      return
    }

    state.config.conferenceResolution = resolution
    res.sendStatus(200)
  })

  api.post('/admin/jams-url', (req, res) => {
    const jamsUrl = req.body.url
    if (!jamsUrl || jamsUrl === '') {
      res.status(400).send('URL not provided')
      return
    }
    state.config.jamsUrl = jamsUrl
    state.config.jamsAuthEnabled = true
    res.sendStatus(200)
  })

  api.delete('/admin/jams-url', (_req, res) => {
    delete state.config.jamsUrl
    state.config.jamsAuthEnabled = false
    res.sendStatus(200)
  })

  // --- Auth routes ---

  api.post('/auth/new-account', (req, res) => {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).send('Missing username or password in body')
      return
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).send('Password must be at least 8 characters long')
      return
    }
    if (state.users[username]) {
      res.status(409).send('Username already exists locally')
      return
    }
    state.users[username] = { password, accountId: 'acc-' + Date.now() }
    state.userTokens['mock-user-token-preset'] ??= username
    res.sendStatus(201)
  })

  api.post('/auth/login', (req, res) => {
    const { username, password, authMethod } = req.body
    if (authMethod === 'guest') {
      if (!state.config.guestAccessEnabled) {
        res.status(400).send('Guest authentication is disabled')
        return
      }

      const guestUsername = `guest-${Date.now()}`
      state.users[guestUsername] = { password: '', accountId: `acc-${guestUsername}` }
      const accessToken = `mock-guest-token-${Date.now()}`
      state.userTokens[accessToken] = guestUsername
      res.json({ accessToken })
      return
    }

    if (!username || !password) {
      res.status(400).send('Missing username or password')
      return
    }
    const user = state.users[username]
    if (!user) {
      res.status(401).send('Invalid credentials')
      return
    }
    if (user.password !== password) {
      res.status(401).send('Invalid credentials')
      return
    }
    const accessToken = 'mock-user-token-' + Date.now()
    state.userTokens[accessToken] = username
    res.json({ accessToken })
  })

  api.get('/auth/oauth/providers', (_req, res) => {
    res.json([])
  })

  // --- Namespace routes ---

  api.head('/ns/name/:username', (req, res) => {
    const { username } = req.params
    if (state.users[username]) {
      res.sendStatus(200)
    } else {
      res.sendStatus(404)
    }
  })

  api.get('/ns/name/:username', (req, res) => {
    const { username } = req.params
    const address = registeredAddresses[username]
    if (!address) {
      res.status(404).send('Name not registered')
      return
    }
    res.json({ name: username, address })
  })

  api.get('/ns/address/:address', (req, res) => {
    const { address } = req.params
    const name = Object.keys(registeredAddresses).find((username) => registeredAddresses[username] === address)
    if (!name) {
      res.status(404).send('Address not registered')
      return
    }
    res.json({ name, address })
  })

  api.get('/ns/jams/:query', (_req, res) => {
    res.json({ state: 1, results: [] })
  })

  // --- Config routes ---

  api.get('/config', (_req, res) => {
    res.json({})
  })

  api.get('/config/languages', (_req, res) => {
    res.json([{ tag: 'en', fullName: 'English' }])
  })

  api.get('/config/languages/:language', (_req, res) => {
    // Load translations from the actual locale file
    const mockFilename = fileURLToPath(import.meta.url)
    const mockDirname = dirname(mockFilename)
    const translationPath = resolve(mockDirname, '..', 'server', 'locale', 'en', 'translation.json')
    try {
      const data = readFileSync(translationPath, 'utf-8')
      res.json(JSON.parse(data))
    } catch {
      res.status(500).json({ error: 'Failed to load translation file' })
    }
  })

  // --- Test helper: reset state ---
  // Always resets to a clean defaultState regardless of the initialState used at startup.
  // This ensures tests that need a blank slate (e.g. admin-setup tests) work correctly.
  app.post('/__reset', (_req, res) => {
    Object.assign(state, { ...defaultState })
    state.config = { ...defaultState.config }
    state.users = {}
    state.userTokens = {}
    state.apiTokens = {}
    state.adminPasskeys = []
    state.userPasskeys = {}
    invitedContacts.length = 0
    res.sendStatus(200)
  })

  // --- Account routes (authenticated) ---

  api.get('/account', (req, res) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/, '')
    const username = token ? state.userTokens[token] : undefined
    const user = username ? state.users[username] : undefined
    if (!username || !user) {
      res.sendStatus(401)
      return
    }

    res.json({
      id: user.accountId,
      details: {
        'Account.id': user.accountId,
        'Account.type': 'RING',
        'Account.alias': username,
        'Account.displayName': username,
        'Account.username': username,
        'Account.deviceID': 'mock-device-id',
        'Account.deviceName': 'Mock Device',
        'Account.enable': 'true',
        'Account.videoEnabled': 'true',
        'Account.autoAnswer': 'false',
        'Account.rendezVous': 'false',
        'RingNS.uri': '',
      },
      volatileDetails: {
        'Account.registeredName': username,
        'Account.registrationStatus': 'REGISTERED',
      },
      defaultModerators: [],
      devices: { 'mock-device-id': 'Mock Device' },
      canChangePassword: true,
    })
  })

  // --- API token routes (authenticated) ---

  api.get('/tokens', (req, res) => {
    const username = getAuthenticatedUsername(req, state)
    if (!username) {
      res.sendStatus(401)
      return
    }

    res.json(state.apiTokens[username] ?? [])
  })

  api.post('/tokens', (req, res) => {
    const username = getAuthenticatedUsername(req, state)
    if (!username) {
      res.sendStatus(401)
      return
    }

    const { name, scopes, expiresInSeconds } = req.body
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
      res.status(400).send('Token name must be between 1 and 100 characters')
      return
    }
    if (
      !Array.isArray(scopes) ||
      !scopes.every((scope): scope is MockApiTokenScope => mockApiTokenScopes.includes(scope)) ||
      new Set(scopes).size !== scopes.length
    ) {
      res.status(400).send('Token scopes must be unique supported scopes')
      return
    }
    if (expiresInSeconds !== undefined && (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0)) {
      res.status(400).send('Token lifetime is invalid')
      return
    }

    const rawToken = randomUUID().replaceAll('-', '')
    const token = `jm_sk_${rawToken}`
    const createdAt = new Date().toISOString()
    const info: MockApiToken = {
      id: randomUUID(),
      prefix: token.slice(0, 14),
      name: name.trim(),
      scopes,
      createdAt,
      expiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000).toISOString() : undefined,
    }
    state.apiTokens[username] ??= []
    state.apiTokens[username].unshift(info)
    res.status(201).json({ token, info })
  })

  api.delete('/tokens/:tokenId', (req, res) => {
    const username = getAuthenticatedUsername(req, state)
    if (!username) {
      res.sendStatus(401)
      return
    }

    const tokens = state.apiTokens[username] ?? []
    const tokenIndex = tokens.findIndex((token) => token.id === req.params.tokenId)
    if (tokenIndex === -1) {
      res.status(404).send('Token not found')
      return
    }

    tokens.splice(tokenIndex, 1)
    res.sendStatus(204)
  })

  api.patch('/account/password', (req, res) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/, '')
    const username = token ? state.userTokens[token] : undefined
    const user = username ? state.users[username] : undefined
    const { currentPassword, newPassword } = req.body

    if (!user) {
      res.sendStatus(401)
      return
    }
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
      res.status(400).send('Current and new passwords are required')
      return
    }
    if (newPassword.length < 8 || newPassword === currentPassword) {
      res.status(422).send('New password does not meet requirements')
      return
    }
    if (user.password !== currentPassword) {
      res.status(409).send('Incorrect current password')
      return
    }

    user.password = newPassword
    res.sendStatus(204)
  })

  api.get('/account/profile/picture', (_req, res) => {
    res.json('')
  })

  api.put('/account/profile', (_req, res) => {
    res.sendStatus(200)
  })

  // --- Contacts routes ---

  api.get('/contacts', (_req, res) => {
    res.json([
      {
        id: 'contact-bob-uri',
        uri: 'contact-bob-uri',
        conversationId: 'conv-1',
        registeredName: 'bob',
        added: String(Math.floor(Date.now() / 1000) - 3600),
        confirmed: 'true',
      },
    ])
  })

  api.put('/contacts/:contactId', (req, res) => {
    const { contactId } = req.params
    const conversationId = `conv-invited-${contactId}`
    invitedContacts.push({ contactId, conversationId })
    res.json({
      id: contactId,
      conversationId,
      added: String(Math.floor(Date.now() / 1000)),
      confirmed: 'false',
      username: '',
    })
  })

  api.get('/contacts/:contactId', (req, res) => {
    res.json({
      uri: req.params.contactId,
      registeredName: 'bob',
      added: String(Math.floor(Date.now() / 1000) - 3600),
      confirmed: 'true',
    })
  })

  api.get('/contacts/:contactId/profile/picture', (_req, res) => {
    res.json('')
  })

  api.get('/contacts/:contactId/username', (req, res) => {
    res.json('bob')
  })

  // --- Conversations routes ---

  api.get('/conversations', (_req, res) => {
    const now = Math.floor(Date.now() / 1000)
    res.json(
      conversationFixtures.map((conversation, index) => ({
        id: conversation.id,
        avatar: '',
        title: conversation.title,
        mode: conversation.mode,
        membersNames: conversation.membersNames,
        lastMessage: {
          id: `msg-${index + 1}`,
          author: `contact-${index + 1}`,
          body: conversation.body,
          type: 'text/plain',
          timestamp: now - (index + 1) * 300,
          linearizedParent: '',
          parents: '',
          status: {
            alice: conversation.unreadFor.includes('alice') ? 2 : 3,
            bob: conversation.unreadFor.includes('bob') ? 2 : 3,
          },
          reactions: [],
        },
      })),
    )
  })

  api.get('/conversations/:conversationId/infos', (req, res) => {
    res.json({
      id: req.params.conversationId,
      title: 'Chat with Bob',
      avatar: '',
      description: '',
      mode: '0',
    })
  })

  api.get('/conversations/:conversationId/members', (_req, res) => {
    res.json([
      { role: 'admin', contact: { uri: 'testuser', registeredName: 'testuser' } },
      { role: 'member', contact: { uri: 'contact-bob-uri', registeredName: 'bob' } },
    ])
  })

  api.get('/conversations/:conversationId/messages', (_req, res) => {
    res.json([
      {
        id: 'msg-1',
        author: 'contact-bob-uri',
        body: 'Hello Alice!',
        type: 'text/plain',
        timestamp: String(Math.floor(Date.now() / 1000) - 60),
        linearizedParent: '',
        parents: '',
        status: {},
        reactions: [],
      },
    ])
  })

  api.post('/conversations/:conversationId/messages', (req, res) => {
    const msgId = 'msg-' + Date.now()
    const conversationId = req.params.conversationId
    const body = req.body.body || ''

    // Broadcast via WebSocket as a ConversationMessage event
    const wsMessage = JSON.stringify({
      type: 'conversation-message',
      data: {
        conversationId,
        message: {
          id: msgId,
          author: 'testuser',
          body,
          type: 'text/plain',
          timestamp: String(Math.floor(Date.now() / 1000)),
          linearizedParent: '',
          parents: '',
          status: {},
          reactions: [],
        },
      },
    })
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(wsMessage)
      }
    }

    res.json({ id: msgId })
  })

  api.get('/conversations/:conversationId/preferences', (_req, res) => {
    res.json({})
  })

  // --- Message edit endpoint ---
  api.post('/conversations/:conversationId/edit-message', (req, res) => {
    const { body, messageId } = req.body
    const conversationId = req.params.conversationId

    // Broadcast a message-edition event via WebSocket
    const wsMessage = JSON.stringify({
      type: 'message-edition',
      data: {
        conversationId,
        message: {
          id: messageId,
          author: 'testuser',
          body,
          type: 'text/plain',
          timestamp: String(Math.floor(Date.now() / 1000)),
          linearizedParent: '',
          parents: '',
          status: {},
          reactions: [],
        },
      },
    })
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(wsMessage)
      }
    }

    res.sendStatus(200)
  })

  // --- Message delete endpoint ---
  api.delete('/conversations/delete/:conversationId/:messageId', (req, res) => {
    res.sendStatus(200)
  })

  api.get('/conversations/:conversationId/files', (_req, res) => {
    res.json([])
  })

  api.get('/conversation-requests', (_req, res) => {
    res.json([
      {
        conversationId: 'invite-1',
        infos: { avatar: '', mode: '0', title: '' },
        from: { uri: 'contact-ivy-uri', registeredName: 'Ivy' },
        received: String(Math.floor(Date.now() / 1000) - 1800),
        membersNames: ['Ivy'],
      },
      {
        conversationId: 'invite-2',
        infos: { avatar: '', mode: '1', title: 'Garden planning' },
        from: { uri: 'contact-jules-uri', registeredName: 'Jules' },
        received: String(Math.floor(Date.now() / 1000) - 3600),
        membersNames: ['Jules', 'Kai'],
      },
      {
        conversationId: 'invite-3',
        infos: { avatar: '', mode: '0', title: '' },
        from: { uri: 'contact-lane-uri', registeredName: 'Lane' },
        received: String(Math.floor(Date.now() / 1000) - 7200),
        membersNames: ['Lane'],
      },
    ])
  })

  // --- File upload endpoint ---
  api.post('/data/:conversationId', (_req, res) => {
    res.json({ id: 'file-msg-' + Date.now() })
  })

  // --- Test helper: inject WebSocket message to all connected clients ---
  app.post('/__ws-send', (req, res) => {
    const message = JSON.stringify(req.body)
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    }
    res.json({ sent: wsClients.size })
  })

  // --- Test helper: report number of connected WebSocket clients ---
  app.get('/__ws-clients', (_req, res) => {
    res.json({ count: [...wsClients].filter((c) => c.readyState === WebSocket.OPEN).length })
  })

  // --- Test helper: report the contacts invited so far ---
  app.get('/__invited-contacts', (_req, res) => {
    res.json(invitedContacts)
  })

  // --- Test helper: add a mock admin passkey ---
  app.post('/__add-admin-passkey', (req, res) => {
    const { credentialId, name } = req.body
    state.adminPasskeys.push({
      credentialId: credentialId || 'mock-cred-' + Date.now(),
      name: name || 'Test Passkey',
      createdAt: new Date().toISOString(),
    })
    res.sendStatus(200)
  })

  // --- Catch-all for unimplemented routes ---
  api.all('/{*path}', (req, res) => {
    console.log(`[mock-server] Unhandled: ${req.method} ${req.url}`)
    res.status(501).json({ error: 'Not implemented in mock server', path: req.url })
  })

  const server = createServer(app)

  // --- WebSocket server ---
  const wss = new WsServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })
  wss.on('connection', (ws) => {
    wsClients.add(ws)
    ws.on('close', () => wsClients.delete(ws))
    ws.on('message', (data) => {
      try {
        JSON.parse(data.toString())
        // Don't echo, just acknowledge — real server sends events proactively
      } catch {
        // ignore
      }
    })
  })

  return { app, server, state, wsClients }
}

export function startMockServer(
  port: number = 5002,
  initialState: Partial<MockServerState> = {},
): Promise<{ server: Server; state: MockServerState; wsClients: Set<WebSocket>; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const { server, state, wsClients } = createMockServer(initialState)
    server.listen(port, () => {
      console.log(`[mock-server] Listening on port ${port}`)
      resolve({
        server,
        state,
        wsClients,
        close: () => new Promise<void>((r) => server.close(() => r())),
      })
    })
  })
}

// Allow running standalone: npx tsx tests/mock-server.ts
if (process.argv[1]?.endsWith('mock-server.ts') || process.argv[1]?.endsWith('mock-server.js')) {
  startMockServer(5002, standaloneInitialState).then(() => {
    console.log('[mock-server] Ready')
    console.log('[mock-server] Admin pre-configured — skip setup wizard')
    console.log('[mock-server]   Admin password : AdminPass123!')
    console.log('[mock-server]   User login     : testuser / Test1234!')
  })
}
