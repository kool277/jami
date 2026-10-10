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
import { randomUUID } from 'node:crypto'

import {
  AccessToken,
  AccountOverview,
  AdminCreateAccountRequest,
  AdminCredentials,
  AdminResetAccountPasswordRequest,
  AdminWizardState,
  ConferenceResolution,
  conferenceResolutionValues,
  HttpStatusCode,
  isMailAddress,
  MIN_PASSWORD_LENGTH,
  RegisteredNameFoundState,
  urlRegex,
} from '@savoirfairelinux/jami-web-common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import envPaths from 'env-paths'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import rateLimit from 'express-rate-limit'
import { ParamsDictionary, Request, Response } from 'express-serve-static-core'
import fs from 'fs'
import { readdir, stat } from 'fs/promises'
import path from 'path'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { adminAuthenticationMiddleware } from '../middleware/auth.js'
import { checkAdminSetup } from '../middleware/setup.js'
import { createLocalAccount, LocalAccountCreationError } from '../services/local-account-service.js'
import { Accounts } from '../storage/accounts.js'
import { AdminAccount } from '../storage/admin-account.js'
import { ApiTokenStore } from '../storage/api-tokens.js'
import { OpenIdProviders } from '../storage/openid-providers.js'
import { PasskeyStore } from '../storage/passkey-store.js'
import { isConfigValid } from '../utils/admin.js'
import { ChallengeStore } from '../utils/challenge-store.js'
import { isElectronMode } from '../utils/electron.js'
import { signJwt } from '../utils/jwt.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { WebSocketServer } from '../websocket/websocket-server.js'

const jamid = Container.get(Jamid)
const adminAccount = Container.get(AdminAccount)
const accounts = Container.get(Accounts)
const tokenStore = Container.get(ApiTokenStore)
const providersSupport = Container.get(OpenIdProviders)
const passkeyStore = Container.get(PasskeyStore)
const webSocketServer = Container.get(WebSocketServer)

const ADMIN_PASSKEY_USERNAME = '__admin__'
const rpName = 'Jami Web'
const adminRegistrationChallenges = new ChallengeStore()
const adminAuthenticationChallenges = new ChallengeStore()

export const adminRouter = Router()

const paths = envPaths('jami', { suffix: '' })
const dataPath = paths.data

const multerPath = adminAccount.getUploadPath()
if (!fs.existsSync(multerPath)) {
  fs.mkdirSync(multerPath)
}

adminRouter.get('/check', (_req, res) => {
  const isSetupComplete = isElectronMode || adminAccount.getPasswordHash() !== undefined
  res.send({ isSetupComplete, electronMode: isElectronMode })
})

adminRouter.get('/admin-wizard-state', (_req, res) => {
  if (isElectronMode) {
    res.send({ lastWizardState: AdminWizardState.complete })
    return
  }
  const lastWizardState = adminAccount.getLastWizardState()
  res.send({ lastWizardState })
})

const createLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
})

const MIN_ADMIN_PASSWORD_LENGTH = 8

adminRouter.post(
  '/create',
  createLimiter,
  asyncHandler(async (req: Request<ParamsDictionary, AccessToken | string, Partial<AdminCredentials>>, res) => {
    // Prevent overwriting an existing admin account
    if (adminAccount.getPasswordHash() !== undefined) {
      res.status(HttpStatusCode.Forbidden).send('Admin account already exists')
      return
    }

    const { password } = req.body
    if (!password || typeof password !== 'string' || password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      res
        .status(HttpStatusCode.BadRequest)
        .send(`Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long`)
      return
    }

    const hashedPassword = await hashPassword(password)

    adminAccount.setPasswordHash(hashedPassword)
    await adminAccount.save()

    const jwt = await signJwt('admin')
    adminAccount.setLastWizardState(AdminWizardState.local)
    res.send({ accessToken: jwt })
  }),
)
//Requests below require a successful setup
adminRouter.use(checkAdminSetup)

const loginlimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // Limit each IP to 3 requests per `window` (here, per 5 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

adminRouter.post(
  '/login',
  loginlimiter,
  asyncHandler(async (req: Request<ParamsDictionary, AccessToken | string, Partial<AdminCredentials>>, res) => {
    const { password } = req.body
    if (password === undefined) {
      res.status(HttpStatusCode.BadRequest).send('Missing password in body')
      return
    }

    const hashedPassword = adminAccount.getPasswordHash()
    if (hashedPassword === undefined) {
      res.status(HttpStatusCode.InternalServerError).send('Admin password not found')
      return
    }

    const isPasswordVerified = await verifyPassword(hashedPassword, password)
    if (!isPasswordVerified) {
      res.status(HttpStatusCode.Unauthorized).send('Incorrect password')
      return
    }

    const jwt = await signJwt('admin')
    res.send({ accessToken: jwt })
  }),
)

// ─── Admin passkey login (public, after setup check) ───────────────────────

function getAdminRpConfig(req: import('express').Request) {
  const host = req.hostname
  const protocol = req.protocol
  const port = req.get('host')?.split(':')[1]
  const origin = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`
  return { rpId: host, origin }
}

adminRouter.post(
  '/passkey/login/options',
  loginlimiter,
  asyncHandler(async (req, res) => {
    const adminPasskeys = passkeyStore.getByUsername(ADMIN_PASSKEY_USERNAME)
    if (adminPasskeys.length === 0) {
      res.status(HttpStatusCode.NotFound).send('No passkeys registered for admin')
      return
    }
    const { rpId } = getAdminRpConfig(req)
    const allowCredentials = adminPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports,
    }))
    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'preferred',
      allowCredentials,
    })
    const challengeKey = randomUUID()
    adminAuthenticationChallenges.set(challengeKey, options.challenge)
    res.json({ ...options, challengeKey })
  }),
)

adminRouter.post(
  '/passkey/login/verify',
  loginlimiter,
  asyncHandler(async (req, res) => {
    const { credential, challengeKey } = req.body
    if (!credential || !challengeKey) {
      res.status(HttpStatusCode.BadRequest).send('Missing credential or challengeKey')
      return
    }
    const expectedChallenge = adminAuthenticationChallenges.consume(challengeKey)
    if (!expectedChallenge) {
      res.status(HttpStatusCode.BadRequest).send('No pending authentication challenge')
      return
    }
    const credentialIdB64 =
      typeof credential.id === 'string' ? credential.id : isoBase64URL.fromBuffer(credential.rawId)
    const match = passkeyStore.findByCredentialId(credentialIdB64)
    if (!match || match.username !== ADMIN_PASSKEY_USERNAME) {
      res.status(HttpStatusCode.Unauthorized).send('Unknown credential')
      return
    }
    const { rpId, origin } = getAdminRpConfig(req)
    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        credential: {
          id: match.passkey.credentialId,
          publicKey: isoBase64URL.toBuffer(match.passkey.publicKey),
          counter: match.passkey.counter,
          transports: match.passkey.transports,
        },
      })
    } catch (e: any) {
      console.error('Admin passkey authentication failed:', e.message)
      res.status(HttpStatusCode.Unauthorized).send('Verification failed')
      return
    }
    if (!verification.verified) {
      res.status(HttpStatusCode.Unauthorized).send('Verification failed')
      return
    }
    passkeyStore.updateCounter(
      ADMIN_PASSKEY_USERNAME,
      match.passkey.credentialId,
      verification.authenticationInfo.newCounter,
    )
    await passkeyStore.save()
    const jwt = await signJwt('admin')
    res.json({ accessToken: jwt })
  }),
)

adminRouter.get(
  '/passkey/available',
  asyncHandler(async (_req, res) => {
    const adminPasskeys = passkeyStore.getByUsername(ADMIN_PASSKEY_USERNAME)
    res.json({ available: adminPasskeys.length > 0 })
  }),
)

adminRouter.get(
  '/config',
  asyncHandler(async (_, res: Response) => {
    if (adminAccount.getOpenIdProvidersNames().length === 0) {
      adminAccount.updateConfig({ openIdAuthEnabled: false })
    }

    const config = adminAccount.getConfig()
    if (config !== undefined) {
      res.status(HttpStatusCode.Ok).send({ ...config, electronMode: isElectronMode })
      return
    }
    res.sendStatus(HttpStatusCode.InternalServerError)
  }),
)

//Requests below require authentication
adminRouter.use(adminAuthenticationMiddleware)

// ─── Admin passkey registration & management (authenticated) ─────────────────

adminRouter.post(
  '/passkey/register/options',
  asyncHandler(async (req, res) => {
    const { rpId } = getAdminRpConfig(req)
    const existingPasskeys = passkeyStore.getByUsername(ADMIN_PASSKEY_USERNAME)
    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports,
    }))
    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: 'admin',
      userDisplayName: 'Admin',
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })
    adminRegistrationChallenges.set('admin', options.challenge)
    res.json(options)
  }),
)

adminRouter.post(
  '/passkey/register/verify',
  asyncHandler(async (req, res) => {
    const expectedChallenge = adminRegistrationChallenges.consume('admin')
    if (!expectedChallenge) {
      res.status(HttpStatusCode.BadRequest).send('No pending registration challenge')
      return
    }
    const { rpId, origin } = getAdminRpConfig(req)
    const { body } = req
    const rawName = typeof body.name === 'string' ? body.name.trim().slice(0, 64) : ''
    const name = rawName || 'Passkey'
    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
      })
    } catch (e: any) {
      console.error('Admin passkey registration verification failed:', e.message)
      res.status(HttpStatusCode.BadRequest).send('Verification failed')
      return
    }
    if (!verification.verified || !verification.registrationInfo) {
      res.status(HttpStatusCode.BadRequest).send('Verification failed')
      return
    }
    const { credential } = verification.registrationInfo
    passkeyStore.add(ADMIN_PASSKEY_USERNAME, {
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: body.credential?.response?.transports,
      createdAt: new Date().toISOString(),
      name,
    })
    await passkeyStore.save()
    res.json({ verified: true })
  }),
)

adminRouter.get(
  '/passkey/credentials',
  asyncHandler(async (_req, res) => {
    const passkeys = passkeyStore.getByUsername(ADMIN_PASSKEY_USERNAME).map((pk) => ({
      credentialId: pk.credentialId,
      name: pk.name,
      createdAt: pk.createdAt,
    }))
    res.json(passkeys)
  }),
)

adminRouter.delete(
  '/passkey/credentials/:credentialId',
  asyncHandler<{ credentialId: string }>(async (req, res) => {
    const { credentialId } = req.params
    const removed = passkeyStore.remove(ADMIN_PASSKEY_USERNAME, credentialId)
    if (!removed) {
      res.status(HttpStatusCode.NotFound).send('Credential not found')
      return
    }
    await passkeyStore.save()
    res.sendStatus(HttpStatusCode.NoContent)
  }),
)

adminRouter.post('/admin-wizard-state', (req: Request<ParamsDictionary, AdminWizardState>, res) => {
  const lastWizardState = req.body.state
  adminAccount.setLastWizardState(lastWizardState)
  res.sendStatus(HttpStatusCode.Ok)
})

adminRouter.get(
  '/is-token-valid',
  asyncHandler(async (_, res: Response) => {
    // If the request reaches this point, the token is valid
    // The token is verified by the adminAuthenticationMiddleware
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.patch(
  '/config',
  asyncHandler(async (req: Request<ParamsDictionary, unknown, unknown>, res: Response) => {
    const config = req.body

    if (!isConfigValid(config)) {
      res.status(HttpStatusCode.BadRequest).send('Invalid config in the payload')
      return
    }
    adminAccount.updateConfig(config)
    try {
      await adminAccount.save()
      res.sendStatus(HttpStatusCode.Ok)
    } catch (e) {
      res.sendStatus(HttpStatusCode.InternalServerError)
    }
  }),
)

//Requests below require authentication
adminRouter.use(adminAuthenticationMiddleware)

adminRouter.patch(
  '/password',
  asyncHandler(async (req, res) => {
    const newPassword = req.body.new
    const oldPassword = req.body.old

    const oldPasswordHash = adminAccount.getPasswordHash()
    if (oldPasswordHash === undefined) {
      res.status(HttpStatusCode.InternalServerError).send('Admin password not found')
      return
    }

    const isPasswordVerified = await verifyPassword(oldPasswordHash, oldPassword)
    if (!isPasswordVerified) {
      res.status(HttpStatusCode.Unauthorized).send('Incorrect password')
      return
    }

    if (newPassword === undefined) {
      res.status(HttpStatusCode.BadRequest).send('Missing password in body')
      return
    }
    if (newPassword) {
      try {
        const hashedPassword = await hashPassword(newPassword)
        adminAccount.setPasswordHash(hashedPassword)
        await adminAccount.save()
        res.sendStatus(HttpStatusCode.Ok)
        return
      } catch (e) {
        res.sendStatus(HttpStatusCode.InternalServerError)
        return
      }
    }
    res.sendStatus(HttpStatusCode.BadRequest)
  }),
)

adminRouter.post(
  '/nameserver',
  asyncHandler(async (req, res) => {
    const nameserver = req.body.nameserver
    // create JSON file is not exists and set the name server address in it
    // replace it if it exists
    // this overrides the default name server address in the daemon
    // https://ns.jami.net

    if (!nameserver || nameserver === '') {
      res.status(HttpStatusCode.BadRequest).send('Nameserver not provided')
      return
    }
    if (!urlRegex.test(nameserver)) {
      res.status(HttpStatusCode.BadRequest).send('Invalid nameserver')
      return
    }
    adminAccount.setNameServerAdress(nameserver)
    adminAccount.save()
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.delete(
  '/nameserver',
  asyncHandler(async (req, res) => {
    adminAccount.resetNameServerAdress()
    adminAccount.save()
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.get(
  '/nameserver',
  asyncHandler(async (req, res) => {
    const nameserver = adminAccount.getNameServerAddress()
    if (nameserver === '') {
      // default name server address
      res.send('https://ns.jami.net')
      return
    }
    res.send(nameserver)
  }),
)

adminRouter.post(
  '/jams-url',
  asyncHandler(async (req, res) => {
    const jamsUrl = req.body.url

    if (!jamsUrl || jamsUrl === '') {
      res.status(HttpStatusCode.BadRequest).send('Nameserver not provided')
      return
    }
    if (!urlRegex.test(jamsUrl)) {
      res.status(HttpStatusCode.BadRequest).send('Invalid url')
      return
    }
    adminAccount.setJamsServerUrl(jamsUrl)
    adminAccount.save()
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.delete(
  '/jams-url',
  asyncHandler(async (req, res) => {
    adminAccount.resetJamsServerUrl()
    adminAccount.save()
    adminAccount.updateConfig({ jamsAuthEnabled: false })
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.get(
  '/jams-url',
  asyncHandler(async (req, res) => {
    const url = adminAccount.getJamsServerUrl()
    if (url === undefined) {
      res.status(HttpStatusCode.NoContent).send('JAMS server URL is not set')
      return
    }
    res.send(url)
  }),
)

const getSizeOnDisk = async (directoryPath: string): Promise<number> => {
  try {
    const files = await readdir(directoryPath)
    const sizes = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(directoryPath, file)
        const stats = await stat(filePath)

        if (stats.isDirectory()) {
          return getSizeOnDisk(filePath)
        }
        return stats.size
      }),
    )

    return sizes.reduce((total, size) => total + size, 0)
  } catch {
    console.error('Directory not found')
    return 0
  }
}

adminRouter.get(
  '/accounts',
  asyncHandler(async (req, res) => {
    const allAccounts = accounts.getAll()
    const localAccounts = allAccounts.local
    const jamsAccounts = allAccounts.jams
    const openIdAccounts = allAccounts.openid
    let accountsList: AccountOverview[] = []

    for (const [username, account] of Object.entries(jamsAccounts)) {
      const accountUri = jamid.getAccountDetails(account.accountId)['Account.username']
      const path = dataPath + '/' + account.accountId
      if (accountUri) {
        accountsList.push({
          username,
          accountUri,
          auth: 'jams',
          storage: await getSizeOnDisk(path),
          accountId: account.accountId,
        })
      }
    }
    for (const [username, account] of Object.entries(localAccounts)) {
      const accountUri = jamid.getAccountDetails(account.accountId)['Account.username']
      const path = dataPath + '/' + account.accountId
      if (accountUri) {
        accountsList.push({
          username,
          accountUri,
          auth: 'local',
          storage: await getSizeOnDisk(path),
          accountId: account.accountId,
        })
      }
    }

    const alreadyAdded: Map<string, string> = new Map()
    for (const [username, account] of Object.entries(openIdAccounts)) {
      const accountUri = jamid.getAccountDetails(account.accountId)['Account.username']
      if (accountUri) {
        const addedAccount = alreadyAdded.get(account.accountId)
        if (addedAccount !== undefined && isMailAddress(addedAccount)) {
          continue
        }

        if (addedAccount !== undefined && !isMailAddress(addedAccount)) {
          accountsList = accountsList.filter((account) => account.username !== addedAccount)
        }
        const path = dataPath + '/' + account.accountId
        accountsList.push({
          username,
          accountUri,
          auth: account.service.join(', '),
          storage: await getSizeOnDisk(path),
          accountId: account.accountId,
        })
        alreadyAdded.set(account.accountId, username)
      }
    }

    for (const [accountId, expirationDate] of Object.entries(accounts.getGuests())) {
      const accountUri = jamid.getAccountDetails(accountId)['Account.username']
      if (accountUri) {
        const path = dataPath + '/' + accountId
        accountsList.push({
          username: accountId,
          accountUri,
          auth: 'guest',
          storage: await getSizeOnDisk(path),
          accountId,
          expirationDate: Number(expirationDate),
        })
        alreadyAdded.set(accountId, accountUri)
      }
    }

    res.send(accountsList)
  }),
)

adminRouter.head(
  '/nameserver/username/:username',
  asyncHandler<{ username: string }>(async (req, res) => {
    try {
      const result = await jamid.lookupUsername(req.params.username, adminAccount.getNameServerAddress())
      switch (result.state) {
        case RegisteredNameFoundState.Found:
          res.status(HttpStatusCode.Ok).end()
          break
        case RegisteredNameFoundState.InvalidResponse:
          res.status(HttpStatusCode.BadRequest).end()
          break
        default:
          res.status(HttpStatusCode.NotFound).end()
          break
      }
    } catch {
      res.status(HttpStatusCode.InternalServerError).end()
    }
  }),
)

adminRouter.post(
  '/accounts',
  asyncHandler(async (req: Request<ParamsDictionary, unknown, AdminCreateAccountRequest>, res) => {
    try {
      const accountId = await createLocalAccount(req.body?.username, req.body?.password, {
        accounts,
        config: adminAccount,
        jamid,
      })
      res.status(HttpStatusCode.Created).send({ accountId })
    } catch (error) {
      if (error instanceof LocalAccountCreationError) {
        res.status(error.status).send(error.message)
        return
      }
      throw error
    }
  }),
)

adminRouter.patch(
  '/accounts/:accountId/password',
  asyncHandler<{ accountId: string }>(
    async (req: Request<{ accountId: string }, unknown, AdminResetAccountPasswordRequest>, res) => {
      const { password } = req.body
      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        res.status(HttpStatusCode.BadRequest).send(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`)
        return
      }

      const { accountId } = req.params
      if (accounts.getLocalByAccountId(accountId) === undefined) {
        res.status(HttpStatusCode.BadRequest).send('Only local account passwords can be reset')
        return
      }

      const hashedPassword = await hashPassword(password)
      if (!accounts.updateLocalPassword(accountId, hashedPassword)) {
        res.status(HttpStatusCode.NotFound).send('Account not found')
        return
      }
      accounts.setSessionsInvalidAfter(accountId)
      await accounts.save()
      tokenStore.revokeAllTokens(accountId)
      await tokenStore.save()
      webSocketServer.closeAccountSockets(accountId)
      res.sendStatus(HttpStatusCode.NoContent)
    },
  ),
)

adminRouter.delete(
  '/accounts',
  asyncHandler(async (req, res) => {
    const users = req.body
    if (
      !Array.isArray(users) ||
      users.some(
        (user) =>
          typeof user !== 'object' ||
          user === null ||
          typeof user.accountId !== 'string' ||
          typeof user.username !== 'string' ||
          typeof user.auth !== 'string',
      )
    ) {
      res.status(HttpStatusCode.BadRequest).send('Invalid accounts payload')
      return
    }

    let passkeysChanged = false
    for (const user of users) {
      const accountId = user.accountId
      jamid.removeAccount(accountId)
      tokenStore.revokeAllTokens(accountId)
      accounts.remove(user.username, user.auth)
      passkeysChanged = passkeyStore.removeAll(user.username) || passkeysChanged
      const userFilePath = multerPath + accountId + '/'
      if (fs.existsSync(userFilePath)) {
        fs.rmdirSync(userFilePath, { recursive: true })
      }
    }
    await accounts.save()
    await tokenStore.save()
    if (passkeysChanged) {
      await passkeyStore.save()
    }
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.get(
  '/oauth/providers',
  asyncHandler(async (_, res) => {
    const supportedProviders = providersSupport.getProviders()
    const data: { name: string; isActive: boolean; displayName: string; icon?: string }[] = []
    Array.from(supportedProviders).map(([key, values]) => {
      data.push({
        name: key,
        isActive: adminAccount.isProviderActive(key),
        displayName: values.displayName,
        icon: values.icon,
      })
    })
    res.send(data)
  }),
)

adminRouter.get(
  '/oauth/provider/:name',
  asyncHandler<{ name: string }>(async (req, res) => {
    const devMode = process.env.NODE_ENV === 'development'
    const provider = req.params.name
    const providerInfo = adminAccount.getOpenIdProvider(provider)
    const providerConfig = providersSupport.getOpenIdConfig(provider)

    const protocol = req.secure ? 'https' : 'http'
    const host = req.get('host')
    const baseUrl = devMode ? 'http://localhost:5002' : `${protocol}://${host}`

    if (providerConfig === undefined) {
      res.status(HttpStatusCode.InternalServerError).send('Provider configuration not found')
      return
    }

    if (providerInfo === undefined) {
      adminAccount.setOpenIdProvider(provider, '', '', false)
      adminAccount.save()
    }

    const data = {
      clientId: providerInfo?.clientId || '',
      isActive: adminAccount.isProviderActive(provider),
      redirectUri: baseUrl + providersSupport.getRedirectUri(provider),
      documentation: providerConfig.documentation,
      displayName: providerConfig.displayName,
      icon: providerConfig.icon,
    }

    res.send(data)
  }),
)

adminRouter.patch(
  '/oauth/provider/:name',
  asyncHandler<{ name: string }>(async (req, res) => {
    const provider = req.params.name
    const providers = adminAccount.getOpenIdProvidersNames()
    if (!providers.includes(provider)) {
      res.status(HttpStatusCode.BadRequest).send('Provider does not exist')
      return
    }

    const clientId = req.body.clientId
    const clientSecret = req.body.clientSecret
    const isActive = req.body.isActive

    if (clientId) {
      adminAccount.setOpenIdProviderClientId(provider, clientId)
    }

    if (clientSecret) {
      adminAccount.setOpenIdProviderClientSecret(provider, clientSecret)
    }

    if (isActive !== undefined) {
      if (isActive) {
        adminAccount.enableOpenIdProvider(provider)
      } else {
        adminAccount.disableOpenIdProvider(provider)
      }
    }

    if (adminAccount.getNumberOfEnabledProviders() === 0) {
      adminAccount.updateConfig({ openIdAuthEnabled: false })
    } else {
      adminAccount.updateConfig({ openIdAuthEnabled: true })
    }

    adminAccount.save()

    res.sendStatus(HttpStatusCode.Ok)
  }),
)

adminRouter.post('/auto-download-limit', (req, res) => {
  const downloadLimit = Number(req.body.limit)
  if (!downloadLimit) {
    res.status(HttpStatusCode.BadRequest)
    return
  }
  if (downloadLimit < 0) {
    res.status(HttpStatusCode.BadRequest).send('Invalid download limit')
    return
  }
  adminAccount.setAutoDownloadLimit(downloadLimit)
  adminAccount.save()
  res.sendStatus(HttpStatusCode.Ok)
})

adminRouter.post('/conference-resolution', (req, res) => {
  const resolution = req.body.resolution

  if (typeof resolution !== 'string' || !conferenceResolutionValues.includes(resolution as ConferenceResolution)) {
    res.status(HttpStatusCode.BadRequest).send('Invalid conference resolution')
    return
  }

  adminAccount.updateConfig({ conferenceResolution: resolution as ConferenceResolution })
  adminAccount.save()
  res.sendStatus(HttpStatusCode.Ok)
})
