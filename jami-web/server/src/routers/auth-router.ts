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
import { AccessToken, AccountDetails, HttpStatusCode, UserCredentials } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import rateLimit from 'express-rate-limit'
import { ParamsDictionary, Request } from 'express-serve-static-core'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { RegistrationState } from '../jamid/state-enums.js'
import { createLocalAccount, LocalAccountCreationError } from '../services/local-account-service.js'
import { LoginGuard } from '../services/LoginGuard.js'
import { Accounts } from '../storage/accounts.js'
import { AdminAccount } from '../storage/admin-account.js'
import { OpenIdProviders } from '../storage/openid-providers.js'
import { isElectronMode } from '../utils/electron.js'
import { clearGuest, clearGuests } from '../utils/guests.js'
import { signJwt, signJwtWithExpiration } from '../utils/jwt.js'
import { exchangeCodeForToken, exchangeTokenForUserInfo, getBase64Picture, getJwt } from '../utils/openid.js'
import { hashPassword, verifyPassword } from '../utils/password.js'

const jamid = Container.get(Jamid)
const accounts = Container.get(Accounts)

const guard = new LoginGuard()

const config = Container.get(AdminAccount)
const providers = Container.get(OpenIdProviders)
export const authRouter = Router()

const backgroundTask = () => {
  console.log(`\n\n[${new Date().toISOString()}] Executing - AUTH - background task`)
  clearPendingAccounts()
}
const INTERVAL = 7200000
// Housekeeping only: it must not be a reason for the process to stay alive.
setInterval(backgroundTask, INTERVAL).unref()

function clearPendingAccounts() {
  const pendingAccounts = accounts.getPendingAccounts()
  for (const pendingAccount of Object.values(pendingAccounts)) {
    accounts.removeAndDeletePendingAccount(pendingAccount)
    accounts.save()
  }
}

clearGuests()

// In Electron mode, expose account IDs for auto-login
if (isElectronMode) {
  authRouter.get(
    '/local-accounts',
    asyncHandler(async (_req, res) => {
      const accountIds = jamid.getAccountIds()
      const accountList = accountIds.map((id) => {
        const details = jamid.getAccountDetails(id)
        const volatile = jamid.getVolatileAccountDetails(id)
        return {
          id,
          registeredName: (volatile as unknown as Record<string, string>)['Account.registeredName'] ?? '',
          displayName: details['Account.displayName'] ?? '',
        }
      })
      res.json({ accounts: accountList })
    }),
  )

  // Dedicated endpoint for switching between local daemon accounts.
  // Accepts an explicit accountId rather than abusing the username/password fields.
  authRouter.post(
    '/switch-account',
    asyncHandler(async (req: Request<ParamsDictionary, AccessToken | string, { accountId?: string }>, res) => {
      const { accountId } = req.body
      if (!accountId || typeof accountId !== 'string') {
        res.status(HttpStatusCode.BadRequest).send('Missing accountId in body')
        return
      }
      const daemonAccountIds = jamid.getAccountIds()
      if (!daemonAccountIds.includes(accountId)) {
        res.status(HttpStatusCode.NotFound).send('Account not found')
        return
      }
      const jwt = await signJwt(accountId)
      res.status(HttpStatusCode.Ok).send({ accessToken: jwt })
    }),
  )
}

const newAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

authRouter.post(
  '/new-account',
  newAccountLimiter,
  asyncHandler(async (req: Request<ParamsDictionary, string, Partial<UserCredentials>>, res) => {
    const { username, password } = req.body
    if (config.getConfig().localAuthEnabled === false) {
      res.status(HttpStatusCode.BadRequest).send('Local authentication is disabled')
      return
    }

    try {
      await createLocalAccount(username, password, { accounts, config, jamid })
      res.sendStatus(HttpStatusCode.Created)
    } catch (error) {
      if (error instanceof LocalAccountCreationError) {
        res.status(error.status).send(error.message)
        return
      }
      throw error
    }
  }),
)

const loginlimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

authRouter.post(
  '/login',
  loginlimiter,
  asyncHandler(async (req: Request<ParamsDictionary, AccessToken | string, Partial<UserCredentials>>, res) => {
    const { username, password, authMethod } = req.body

    if (authMethod === 'guest') {
      if (config.getConfig().guestAccessEnabled === false) {
        res.status(HttpStatusCode.BadRequest).send('Guest authentication is disabled')
        return
      }

      const { accountId } = await jamid.addAccount({})

      const sessionTime = 2 * 60 * 60 * 1000
      const date = Date.now() + sessionTime

      accounts.set(accountId, date.toString(), 'guest', accountId)
      await accounts.save()

      const jwt = await signJwtWithExpiration(accountId, '2h')

      res.send({ accessToken: jwt })
      setTimeout(() => clearGuest(accountId), sessionTime).unref()
      return
    }

    if (username === undefined || (password === undefined && !(isElectronMode && authMethod === 'local'))) {
      res.status(HttpStatusCode.BadRequest).send('Missing username or password in body')
      return
    }
    // Check if the account is stored on this daemon instance
    if (authMethod === 'jams') {
      if (config.getConfig().jamsAuthEnabled === false) {
        res.status(HttpStatusCode.BadRequest).send('Jams authentication is disabled')
        return
      }
      //When the user logs in for the first time, we need to set up their account by assigning the relevant details:

      //This sets the Jams Server URL (managerUri) and sends a request to add the account using addAccount.
      //If the registrationState is valid, the account is created in the daemon, and both the hashed password and login are stored in accounts.json.

      //For future logins, the user will be authenticated using these stored values.

      const accountDetails: Partial<AccountDetails> = {
        // TODO: Enable encrypted archives
        // 'Account.archivePassword': password
      }
      accountDetails['Account.managerUri'] = config.getJamsServerUrl()
      accountDetails['Account.managerUsername'] = username
      accountDetails['Account.archivePassword'] = password

      // same password we need to connect the user to the account
      const data = accounts.get(username, 'jams')

      if (data === undefined || typeof data === 'string') {
        // we need to create a new account
        const { accountId: JAMSAccountId, state } = await jamid.addAccount(accountDetails)
        if (state === RegistrationState.ErrorGeneric) {
          jamid.removeAccount(JAMSAccountId)
          res.status(HttpStatusCode.Unauthorized).send('Invalid JAMS credentials')
        } else {
          const hashedPassword = await hashPassword(password!)
          try {
            accounts.set(username, hashedPassword, authMethod, JAMSAccountId)
            await accounts.save()
            // now we need to get the accountId from the username and return it
            const jwt = await signJwt(JAMSAccountId)
            res.status(HttpStatusCode.Ok).send({ accessToken: jwt })
          } catch (e: any) {
            console.error(e)
            res.status(HttpStatusCode.InternalServerError).send(e.message)
          }
        }
        return
      }

      if (typeof data === 'object' && !('password' in data)) {
        return
      }
      if (data.password === undefined) {
        res.status(HttpStatusCode.Unauthorized).send('Invalid credentials')
        return
      }
      const JAMSAccountId = data.accountId

      if (guard.isBlocked(JAMSAccountId)) {
        res.status(HttpStatusCode.TooManyRequests).send('Too many login attempts')
        return
      }

      const isPasswordVerified = await verifyPassword(data.password, password!)
      if (!isPasswordVerified) {
        guard.setFailedLogin(JAMSAccountId)
        res.status(HttpStatusCode.Unauthorized).send('Incorrect password')
        return
      }
      if (JAMSAccountId === undefined) {
        res.status(HttpStatusCode.Unauthorized).send('Invalid credentials')
        return
      }

      let accountId = JAMSAccountId
      if (!jamid.getAccountIds().includes(accountId)) {
        const registration = await jamid.addAccount(accountDetails)
        if (registration.state === RegistrationState.ErrorGeneric) {
          jamid.removeAccount(registration.accountId)
          res.status(HttpStatusCode.Unauthorized).send('Invalid JAMS credentials')
          return
        }
        accountId = registration.accountId
        accounts.set(username, data.password, authMethod, accountId)
        await accounts.save()
      }

      const jwt = await signJwt(accountId)
      guard.resetAttempts(accountId)
      res.status(HttpStatusCode.Ok).send({ accessToken: jwt })
      return
    } else if (authMethod === 'local') {
      if (!isElectronMode && config.getConfig().localAuthEnabled === false) {
        res.status(HttpStatusCode.BadRequest).send('Local authentication is disabled')
        return
      }

      // In Electron mode, look up the account directly from the daemon by accountId
      if (isElectronMode) {
        const daemonAccountIds = jamid.getAccountIds()
        const targetAccountId = daemonAccountIds.includes(username) ? username : undefined
        if (!targetAccountId) {
          res.status(HttpStatusCode.Unauthorized).send('Invalid credentials')
          return
        }
        const jwt = await signJwt(targetAccountId)
        res.status(HttpStatusCode.Ok).send({ accessToken: jwt })
        return
      }

      const data = accounts.get(username)
      if (typeof data === 'string' || data === undefined) {
        res.status(HttpStatusCode.Unauthorized).send('Invalid credentials')
        return
      }

      const accountId = data?.accountId
      if (accountId === undefined) {
        res.status(HttpStatusCode.Unauthorized).send('Invalid credentials')
        return
      }

      if (guard.isBlocked(accountId)) {
        res.status(HttpStatusCode.TooManyRequests).send('Too many login attempts')
        return
      }

      if (!('password' in data)) {
        res.status(HttpStatusCode.Unauthorized).send('Invalid credentials')
        return
      }

      const hashedPassword = data.password

      if (hashedPassword === undefined || typeof hashedPassword !== 'string') {
        res
          .status(HttpStatusCode.Unauthorized)
          .send('Password not found (the account does not have a password set on the server)')
        return
      }
      const isPasswordVerified = await verifyPassword(hashedPassword, password!)
      if (!isPasswordVerified) {
        guard.setFailedLogin(accountId)
        res.status(HttpStatusCode.Unauthorized).send('Incorrect password')
        return
      }
      const jwt = await signJwt(accountId)
      guard.resetAttempts(accountId)
      res.status(HttpStatusCode.Ok).send({ accessToken: jwt })
    }
  }),
)

authRouter.get(
  '/link-token',
  asyncHandler(async (req, res) => {
    const values = await jamid.getLinkToken()
    const accountId = values.accountId
    const data = {
      ...values,
      jwt: await signJwt(accountId), // tmp jwt
    }
    accounts.addPendingAccount(accountId)
    accounts.save()
    res.send(data)
  }),
)

authRouter.post(
  '/link/authenticate',
  asyncHandler(async (req, res) => {
    const accountId = req.body.values.accountId
    const password = req.body.values.password
    const scheme = req.body.values.scheme

    if (accountId === undefined || password === undefined || scheme === undefined) {
      res.status(HttpStatusCode.BadRequest).send('Missing accountId, password or scheme in body')
      return
    }

    jamid.provideAccountAuthentication(accountId, password, scheme)

    res.status(HttpStatusCode.Ok).end()
  }),
)

authRouter.post(
  '/link/cancel',
  asyncHandler(async (req, res) => {
    const accountId = req.body.accountId
    accounts.removeAndDeletePendingAccount(accountId)
    accounts.save()
    res.status(HttpStatusCode.Ok).end()
  }),
)

authRouter.post(
  '/link/password',
  asyncHandler(async (req, res) => {
    const accountId = req.body.accountId
    const password = req.body.password
    const hashedPassword = await hashPassword(password)

    const volatileDetails = jamid.getVolatileAccountDetails(accountId)
    const details = jamid.getAccountDetails(accountId)
    const userName = volatileDetails['Account.registeredName']
    const uri = details['Account.username']

    // we will remove the account from the pending accounts
    // not matter what happens
    accounts.removePendingAccount(accountId)
    accounts.save()

    if (userName === undefined) {
      if (uri === undefined) {
        // we need to create a new account
        // with a username and a password
        jamid.removeAccount(accountId)
        res.status(HttpStatusCode.NotFound).send('Username not found')
        return
      }
      accounts.set(uri, hashedPassword, 'local', accountId)
      await accounts.save()
      const jwt = await signJwt(accountId)
      res.send({ accessToken: jwt })
      return
    }

    accounts.set(userName, hashedPassword, 'local', accountId)
    await accounts.save()
    const jwt = await signJwt(accountId)
    res.send({ accessToken: jwt })
  }),
)

// not used for now
authRouter.post(
  '/guest/extend',
  asyncHandler(async (req, res) => {
    // extend the token for 24h
    const accountId = res.locals.accountId
    const jwt = await signJwtWithExpiration(accountId, '2h')
    const date = Date.now() + 2 * 60 * 60 * 1000
    accounts.set(accountId, date.toString(), 'guest', '')
    accounts.save()
    res.send({ accessToken: jwt })
  }),
)

/*
 *  OAUTH2 FLOW WITH ANY PROVIDER
 */

authRouter.get(
  '/oauth/providers',
  asyncHandler(async (req, res) => {
    const protocol = req.secure ? 'https' : 'http'
    const host = req.get('host')
    const baseUrl = `${protocol}://${host}`
    const urls = providers.getAllAuthorizeUrls()
    const array = []
    for (const [provider, url] of urls) {
      const displayName = providers.getDisplayName(provider)
      const icon = providers.getIcon(provider)
      const colorTheme = providers.getColorTheme(provider)
      const redirectUri = url + '&redirect_uri=' + baseUrl + providers.getRedirectUri(provider)
      array.push({ provider, displayName, icon, colorTheme, redirectUri })
    }
    res.send(array)
  }),
)

authRouter.get(
  '/oauth/:provider/callback',
  asyncHandler<{ provider: string }>(async (req, res) => {
    const devMode = process.env.NODE_ENV === 'development'
    const provider = req.params.provider
    const code = req.query.code
    const protocol = req.secure ? 'https' : 'http'
    const host = req.get('host')
    const baseUrl = `${protocol}://${host}`

    const loginUrl = devMode ? 'http://localhost:3000/login' : baseUrl + '/login'

    if (config.getConfig().openIdAuthEnabled === false) {
      res.status(HttpStatusCode.BadRequest).send('OpenID authentication is disabled')
      res.redirect(loginUrl)
      return
    }

    const supportedProviders = providers.getOpenIdProvidersNames()
    const configuredProviders = config.getOpenIdProvidersNames()

    if (!provider) {
      res.status(HttpStatusCode.BadRequest).send('Missing provider in path')
      res.redirect(loginUrl)
      return
    }

    if (!supportedProviders.includes(provider)) {
      res.status(HttpStatusCode.BadRequest).send('Unsupported provider')
      res.redirect(loginUrl)
      return
    }

    if (!configuredProviders.includes(provider)) {
      res.status(HttpStatusCode.BadRequest).send('Provider not configured')
      res.redirect(loginUrl)
      return
    }

    if (!code) {
      res.status(HttpStatusCode.BadRequest).send('Missing code in query parameters')
      res.redirect(loginUrl)
      return
    }

    const isActive = config.isProviderActive(provider)

    if (!isActive) {
      res.status(HttpStatusCode.BadRequest).send('Provider is not active')
      res.redirect(loginUrl)
      return
    }

    const data = await exchangeCodeForToken(code as string, provider, baseUrl)
    if (data === undefined) {
      res.status(HttpStatusCode.BadRequest).send('Invalid code')
      res.redirect(loginUrl)
      return
    }

    let accessToken = data.access_token

    if (typeof data === 'string' && data.includes('&')) {
      const line = data.split('&')
      for (const item of line) {
        if (item.includes('access_token')) {
          accessToken = item.replace('access_token=', '')
          break
        }
      }
    }

    const userInfo = await exchangeTokenForUserInfo(accessToken, provider)

    if (userInfo === undefined) {
      res.status(HttpStatusCode.BadRequest).send('Invalid token')
      res.redirect(loginUrl)
      return
    }

    let key

    const sub = userInfo.sub !== undefined ? String(userInfo.sub) : undefined
    const id = userInfo.id !== undefined ? String(userInfo.id) : undefined

    key = sub
    if (!sub) {
      key = id
    }

    if (!key) {
      res.status(HttpStatusCode.BadRequest).send('Cannot use this provider')
      res.redirect(loginUrl)
      return
    }

    const name =
      [userInfo.name, userInfo.global_name, userInfo.username].find(
        (value): value is string => typeof value === 'string' && value.trim() !== '',
      ) ?? key

    // this duplicates the account storage for the same user but
    // ensure that the user can login with any of the keys

    const savedAccount = accounts.getOpenIdAccount(key)
    if (savedAccount !== undefined && accounts.getOpenIdAccount(key) === undefined) {
      accounts.set(key, [provider], 'openid', savedAccount.accountId) // now the user can cannot using either the sub or the email
      accounts.save()
    }

    const jwt = await getJwt(key, name, provider)
    if (jwt === 'INVALID') {
      res.redirect(loginUrl)
      return
    }

    const account = accounts.getOpenIdAccount(key)
    if (account === undefined) {
      res.status(HttpStatusCode.InternalServerError).send('Account not found')
      res.redirect(loginUrl)
      return
    }

    for (const profilePicture of [userInfo.picture, userInfo.avatar_url]) {
      if (typeof profilePicture !== 'string') {
        continue
      }
      try {
        const base64Img = await getBase64Picture(profilePicture)
        jamid.updateProfile(account.accountId, name, base64Img, 'PNG', '', 1)
      } catch {
        console.warn(`Unable to download profile picture from ${provider}`)
      }
    }

    res.redirect(loginUrl + '?accessToken=' + jwt)
  }),
)
