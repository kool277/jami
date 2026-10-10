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

import { HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import rateLimit from 'express-rate-limit'
import { Container } from 'typedi'

import { authenticateToken } from '../middleware/auth.js'
import { Accounts } from '../storage/accounts.js'
import { PasskeyStore } from '../storage/passkey-store.js'
import { ChallengeStore } from '../utils/challenge-store.js'
import { signJwt } from '../utils/jwt.js'

const accounts = Container.get(Accounts)
const passkeyStore = Container.get(PasskeyStore)

const rpName = 'Jami Web'

// Challenge stores for registration and authentication ceremonies
const registrationChallenges = new ChallengeStore()
const authenticationChallenges = new ChallengeStore()

export const passkeyRouter = Router()

/**
 * Derive the Relying Party ID and expected origin from the request.
 * This allows the server to work on any hostname without configuration.
 */
function getRpConfig(req: import('express').Request) {
  const host = req.hostname // e.g. "localhost" or "jami.example.com"
  const protocol = req.protocol // "http" or "https"
  const port = req.get('host')?.split(':')[1] // may be undefined
  const origin = port ? `${protocol}://${host}:${port}` : `${protocol}://${host}`
  return { rpId: host, origin }
}

// ─── Registration (requires authentication) ──────────────────────────────────

/**
 * POST /register/options
 * Generates WebAuthn registration options for the authenticated user.
 */
passkeyRouter.post(
  '/register/options',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const accountId: string = res.locals.accountId
    // Find the username from the accountId
    const username = findUsernameByAccountId(accountId)
    if (!username) {
      res.status(HttpStatusCode.NotFound).send('Account not found')
      return
    }

    const { rpId } = getRpConfig(req)

    const existingPasskeys = passkeyStore.getByUsername(username)
    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports,
    }))

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    registrationChallenges.set(accountId, options.challenge)
    res.json(options)
  }),
)

/**
 * POST /register/verify
 * Verifies the registration response and stores the new passkey.
 */
passkeyRouter.post(
  '/register/verify',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const accountId: string = res.locals.accountId
    const username = findUsernameByAccountId(accountId)
    if (!username) {
      res.status(HttpStatusCode.NotFound).send('Account not found')
      return
    }

    const expectedChallenge = registrationChallenges.consume(accountId)
    if (!expectedChallenge) {
      res.status(HttpStatusCode.BadRequest).send('No pending registration challenge')
      return
    }

    const { rpId, origin } = getRpConfig(req)

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
      console.error('Passkey registration verification failed:', e.message)
      res.status(HttpStatusCode.BadRequest).send('Verification failed')
      return
    }

    if (!verification.verified || !verification.registrationInfo) {
      res.status(HttpStatusCode.BadRequest).send('Verification failed')
      return
    }

    const { credential } = verification.registrationInfo
    passkeyStore.add(username, {
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

// ─── Authentication (public) ─────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /login/options
 * Generates authentication options. If username is provided, scopes to that user's credentials.
 */
passkeyRouter.post(
  '/login/options',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { rpId } = getRpConfig(req)
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : undefined

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] | undefined
    if (username) {
      const userPasskeys = passkeyStore.getByUsername(username)
      // Return empty allowCredentials (not 404) to avoid user enumeration
      allowCredentials = userPasskeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports,
      }))
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      userVerification: 'preferred',
      allowCredentials,
    })

    // Use a random key to avoid leaking the challenge value or enabling user enumeration
    const challengeKey = randomUUID()
    authenticationChallenges.set(challengeKey, options.challenge)
    res.json({ ...options, challengeKey })
  }),
)

/**
 * POST /login/verify
 * Verifies the authentication response and returns a JWT.
 */
passkeyRouter.post(
  '/login/verify',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { challengeKey, credential } = req.body
    if (!challengeKey || !credential) {
      res.status(HttpStatusCode.BadRequest).send('Missing challengeKey or credential')
      return
    }

    const expectedChallenge = authenticationChallenges.consume(challengeKey)
    if (!expectedChallenge) {
      res.status(HttpStatusCode.BadRequest).send('No pending authentication challenge')
      return
    }

    // Look up the credential in the store
    const credentialIdB64 =
      typeof credential.id === 'string' ? credential.id : isoBase64URL.fromBuffer(credential.rawId)
    const match = passkeyStore.findByCredentialId(credentialIdB64)
    if (!match) {
      res.status(HttpStatusCode.Unauthorized).send('Unknown credential')
      return
    }

    const { rpId, origin } = getRpConfig(req)

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
      console.error('Passkey authentication verification failed:', e.message)
      res.status(HttpStatusCode.Unauthorized).send('Verification failed')
      return
    }

    if (!verification.verified) {
      res.status(HttpStatusCode.Unauthorized).send('Verification failed')
      return
    }

    // Update counter
    passkeyStore.updateCounter(match.username, match.passkey.credentialId, verification.authenticationInfo.newCounter)
    await passkeyStore.save()

    // Resolve accountId from the username
    const accountData = accounts.get(match.username, 'local')
    if (!accountData || typeof accountData === 'string') {
      res.status(HttpStatusCode.InternalServerError).send('Account data missing')
      return
    }

    const jwt = await signJwt(accountData.accountId)
    res.json({ accessToken: jwt })
  }),
)

// ─── Credential management (authenticated) ──────────────────────────────────

/**
 * GET /credentials
 * Lists the passkeys registered for the authenticated user.
 */
passkeyRouter.get(
  '/credentials',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    const accountId: string = res.locals.accountId
    const username = findUsernameByAccountId(accountId)
    if (!username) {
      res.status(HttpStatusCode.NotFound).send('Account not found')
      return
    }
    const passkeys = passkeyStore.getByUsername(username).map((pk) => ({
      credentialId: pk.credentialId,
      name: pk.name,
      createdAt: pk.createdAt,
    }))
    res.json(passkeys)
  }),
)

/**
 * DELETE /credentials/:credentialId
 * Removes a passkey for the authenticated user.
 */
passkeyRouter.delete(
  '/credentials/:credentialId',
  authenticateToken,
  asyncHandler<{ credentialId: string }>(async (req, res) => {
    const accountId: string = res.locals.accountId
    const username = findUsernameByAccountId(accountId)
    if (!username) {
      res.status(HttpStatusCode.NotFound).send('Account not found')
      return
    }
    const { credentialId } = req.params
    const removed = passkeyStore.remove(username, credentialId)
    if (!removed) {
      res.status(HttpStatusCode.NotFound).send('Credential not found')
      return
    }
    await passkeyStore.save()
    res.sendStatus(HttpStatusCode.NoContent)
  }),
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findUsernameByAccountId(accountId: string): string | undefined {
  const allAccounts = accounts.getAll()
  for (const [username, data] of Object.entries(allAccounts.local)) {
    if (data.accountId === accountId) return username
  }
  return undefined
}
