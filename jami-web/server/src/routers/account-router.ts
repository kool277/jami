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
import { resolve } from 'node:path'

import {
  AccountDetails,
  DeviceRevocationState,
  HttpStatusCode,
  IAccount,
  IContact,
  MIN_PASSWORD_LENGTH,
} from '@savoirfairelinux/jami-web-common'
import { Request, Router } from 'express'
import asyncHandler from 'express-async-handler'
import { ParamsDictionary } from 'express-serve-static-core'
import fs from 'fs'
import multer from 'multer'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'
import { Accounts } from '../storage/accounts.js'
import { ApiTokenStore } from '../storage/api-tokens.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { clearAvatarCache } from '../utils/vCard.js'
import { WebSocketServer } from '../websocket/websocket-server.js'

const jamid = Container.get(Jamid)
const accounts = Container.get(Accounts)
const tokenStore = Container.get(ApiTokenStore)
const webSocketServer = Container.get(WebSocketServer)
export const accountRouter = Router()

accountRouter.use(authenticateToken)
accountRouter.use(extendIfGuest)
accountRouter.use(requireApiTokenScope('account'))

// TODO: Do we really need this route to return the default moderators?
// It would be cleaner just to GET /default-moderators for this
accountRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const accountId = res.locals.accountId
    // Add usernames for default moderators
    const defaultModeratorUris = jamid.getDefaultModeratorUris(accountId)
    const namedDefaultModerators: IContact[] = []

    for (const defaultModeratorUri of defaultModeratorUris) {
      try {
        const { name } = await jamid.lookupAddress(defaultModeratorUri, '', accountId)
        namedDefaultModerators.push({
          uri: defaultModeratorUri,
          registeredName: name,
        })
      } catch (e) {
        namedDefaultModerators.push({
          uri: defaultModeratorUri,
          registeredName: defaultModeratorUri,
        })
      }
    }

    const account: IAccount = {
      id: accountId,
      details: jamid.getAccountDetails(accountId),
      volatileDetails: jamid.getVolatileAccountDetails(accountId),
      defaultModerators: namedDefaultModerators,
      devices: jamid.getDevices(accountId),
      canChangePassword: accounts.getLocalByAccountId(accountId) !== undefined,
    }
    res.send(account)
  }),
)

accountRouter.patch('/', (req: Request<ParamsDictionary, string, Partial<AccountDetails>>, res) => {
  const accountId = res.locals.accountId

  if (typeof accountId !== 'string') {
    res.sendStatus(HttpStatusCode.BadRequest)
    return
  }

  const currentAccountDetails = jamid.getAccountDetails(accountId)
  const newAccountDetails: AccountDetails = { ...currentAccountDetails, ...req.body }
  jamid.setAccountDetails(accountId, newAccountDetails)

  res.sendStatus(HttpStatusCode.NoContent)
})

accountRouter.patch(
  '/password',
  asyncHandler(async (req, res) => {
    const accountId = res.locals.accountId
    const { currentPassword, newPassword } = req.body

    if (
      typeof accountId !== 'string' ||
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      currentPassword === '' ||
      newPassword === ''
    ) {
      res.status(HttpStatusCode.BadRequest).send('Current and new passwords are required')
      return
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res
        .status(HttpStatusCode.UnprocessableEntity)
        .send(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`)
      return
    }

    if (currentPassword === newPassword) {
      res.status(HttpStatusCode.UnprocessableEntity).send('New password must differ from the current password')
      return
    }

    const account = accounts.getLocalByAccountId(accountId)
    if (!account) {
      res.status(HttpStatusCode.Forbidden).send('Password changes are unavailable for this account')
      return
    }

    if (!(await verifyPassword(account.password, currentPassword))) {
      res.status(HttpStatusCode.Conflict).send('Incorrect current password')
      return
    }

    const hashedPassword = await hashPassword(newPassword)
    const previousHashedPassword = account.password
    accounts.updateLocalPassword(accountId, hashedPassword)
    // A password change is how a user locks out a compromised device, so every credential minted
    // under the old password has to stop working before the request is acknowledged.
    accounts.setSessionsInvalidAfter(accountId)
    try {
      await accounts.save()
    } catch (error) {
      accounts.updateLocalPassword(accountId, previousHashedPassword)
      throw error
    }
    tokenStore.revokeAllTokens(accountId)
    await tokenStore.save()
    webSocketServer.closeAccountSockets(accountId)
    res.sendStatus(HttpStatusCode.NoContent)
  }),
)

const dir = resolve(process.cwd(), 'profile-avatar')
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir)
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname)
  },
})
const upload = multer({ storage: storage })

accountRouter.post(
  '/avatar',
  upload.array('avatar', 1),
  asyncHandler(async (req, res) => {
    if (req.files === undefined || req.files.length === 0) {
      res.status(HttpStatusCode.BadRequest).send()
      return
    }
    const accountId = res.locals.accountId

    const accountDetails = jamid.getAccountDetails(accountId)
    const files = req.files as Express.Multer.File[]
    const path = files[0].path
    const fileType = files[0].mimetype === 'image/jpeg' ? 'JPEG' : 'PNG'

    // so it does not change the displayName
    jamid.updateProfile(accountId, accountDetails['Account.displayName'], path, fileType, '', 0)

    // Invalidate the cached avatar so the next read regenerates it from the
    // updated profile (otherwise the stale cached image keeps being served).
    // 'Account.username' actually stores the account's own URI.
    await clearAvatarCache(accountId, accountDetails['Account.username'])

    res.status(HttpStatusCode.Ok).send()
  }),
)
accountRouter.delete(
  '/avatar',
  asyncHandler(async (req, res) => {
    const accountId = res.locals.accountId
    const accountDetails = jamid.getAccountDetails(accountId)

    jamid.updateProfile(accountId, accountDetails['Account.displayName'], '', '', '', 0)
    await clearAvatarCache(accountId, accountDetails['Account.username'])
    res.sendStatus(HttpStatusCode.NoContent)
  }),
)
accountRouter.post(
  '/:deviceId/revoke',
  asyncHandler<{ deviceId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const deviceId = req.params.deviceId
    const password = req.body.password
    try {
      const value = await jamid.revokeDevice(accountId, deviceId, 'password', password)
      if (value.state === DeviceRevocationState.SUCCESS) {
        res.sendStatus(HttpStatusCode.Ok)
      } else {
        res.status(HttpStatusCode.BadRequest).send(value.state)
      }
    } catch (e) {
      console.error('Error revoking device', e)
      res.status(HttpStatusCode.InternalServerError).send()
    }
  }),
)

accountRouter.post('/display-name/reset', (req, res) => {
  const accountId = res.locals.accountId
  const account = jamid.getAccountDetails(accountId)

  if (account['Account.displayName'] === account['Account.username']) {
    res.sendStatus(HttpStatusCode.Ok)
    return
  }
  jamid.updateProfile(accountId, '', '', '', '', 10)
  res.sendStatus(HttpStatusCode.NoContent)
})

accountRouter.post('/display-name', (req, res) => {
  const accountId = res.locals.accountId
  const displayName = req.body.displayName
  const account = jamid.getAccountDetails(accountId)

  if (account['Account.displayName'] === displayName) {
    res.sendStatus(HttpStatusCode.Ok)
    return
  }
  jamid.updateProfile(accountId, displayName, '', '', '', 10)
  res.sendStatus(HttpStatusCode.NoContent)
})

accountRouter.post(
  '/add-device',
  asyncHandler(async (req, res) => {
    const uri = req.body.uri
    const accountId = res.locals.accountId
    jamid.addDevice(accountId, uri)
    res.sendStatus(HttpStatusCode.Ok)
  }),
)

accountRouter.post('/:opId/confirm-device', (req, res) => {
  const accountId = res.locals.accountId
  const opId = Number(req.params.opId)
  jamid.confirmDevice(accountId, opId)
  res.sendStatus(HttpStatusCode.Ok)
})

accountRouter.post('/:opId/cancel-device', (req, res) => {
  const accountId = res.locals.accountId
  const opId = Number(req.params.opId)
  jamid.cancelDevice(accountId, opId)
  jamid.removeAccount(accountId)
  res.sendStatus(HttpStatusCode.Ok)
})
