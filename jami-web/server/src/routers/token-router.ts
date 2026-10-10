/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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
import { API_TOKEN_SCOPES, type CreateApiTokenRequest, HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import { Container } from 'typedi'

import { authenticateToken, requireSessionAuthentication } from '../middleware/auth.js'
import {
  ApiTokenStore,
  MAX_API_TOKEN_LIFETIME_SECONDS,
  MAX_API_TOKEN_NAME_LENGTH,
  type TokenScope,
} from '../storage/api-tokens.js'

const tokenStore = Container.get(ApiTokenStore)

export const tokenRouter = Router()

// All token routes require authentication
tokenRouter.use(authenticateToken)
tokenRouter.use(requireSessionAuthentication)

// Create a new API token
tokenRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const accountId = res.locals.accountId as string
    const body = req.body as Partial<CreateApiTokenRequest>
    const name = body.name?.trim()
    const scopes = body.scopes

    if (!name || name.length > MAX_API_TOKEN_NAME_LENGTH) {
      res.status(HttpStatusCode.BadRequest).send('Token name must be between 1 and 100 characters')
      return
    }

    if (
      !Array.isArray(scopes) ||
      scopes.length === 0 ||
      !scopes.every((scope): scope is TokenScope => API_TOKEN_SCOPES.includes(scope as TokenScope)) ||
      new Set(scopes).size !== scopes.length
    ) {
      res.status(HttpStatusCode.BadRequest).send('Token scopes must be a non-empty list of unique supported scopes')
      return
    }

    const expiresInSeconds = body.expiresInSeconds
    if (
      expiresInSeconds !== undefined &&
      (!Number.isSafeInteger(expiresInSeconds) ||
        expiresInSeconds <= 0 ||
        expiresInSeconds > MAX_API_TOKEN_LIFETIME_SECONDS)
    ) {
      res.status(HttpStatusCode.BadRequest).send('Token lifetime is invalid')
      return
    }

    const { token, info } = tokenStore.createToken(accountId, name, scopes, expiresInSeconds)
    await tokenStore.save()

    res.status(HttpStatusCode.Created).json({ token, info })
  }),
)

// List all tokens for the authenticated account
tokenRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const accountId = res.locals.accountId as string
    const tokens = tokenStore.listTokens(accountId)
    res.json(tokens)
  }),
)

// Revoke a token
tokenRouter.delete(
  '/:tokenId',
  asyncHandler<{ tokenId: string }>(async (req, res) => {
    const accountId = res.locals.accountId as string
    const { tokenId } = req.params

    const revoked = tokenStore.revokeToken(tokenId, accountId)
    if (!revoked) {
      res.status(HttpStatusCode.NotFound).send('Token not found')
      return
    }

    await tokenStore.save()
    res.sendStatus(HttpStatusCode.NoContent)
  }),
)
