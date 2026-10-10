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
import { existsSync } from 'node:fs'

import { getAdminSetupRedirect, HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import cors, { type CorsOptions } from 'cors'
import express, { json, NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import log from 'loglevel'
import path from 'path'
import { Container, Service } from 'typedi'
import { fileURLToPath } from 'url'

import { accountRouter } from './routers/account-router.js'
import { adminRouter } from './routers/admin-router.js'
import { authRouter } from './routers/auth-router.js'
import { callRouter } from './routers/call-router.js'
import { configRouter } from './routers/config.js'
import { contactsRouter } from './routers/contacts-router.js'
import { conversationRequestRouter } from './routers/conversation-request-router.js'
import { conversationRouter } from './routers/conversation-router.js'
import { dataTransferRouter } from './routers/data-transfer.js'
import { defaultModeratorsRouter } from './routers/default-moderators-router.js'
import { linkPreviewRouter } from './routers/link-preview-router.js'
import { nameserverRouter } from './routers/nameserver-router.js'
import { passkeyRouter } from './routers/passkey-router.js'
import { presenceRouter } from './routers/presence-router.js'
import { tokenRouter } from './routers/token-router.js'
import { AdminAccount } from './storage/admin-account.js'
import { isElectronMode } from './utils/electron.js'
import { loadEnv } from './utils/env.js'
import { bindChatCallbacks } from './websocket/chat-handler.js'
import { bindReactionAddedCallBack } from './websocket/chat-reactionadded-handler.js'
import { bindReactionRemovedCallBack } from './websocket/chat-reactionremoved-handler.js'
import { bindLoadMoreMessagesCallBack } from './websocket/load-more-messages-handler.js'
import { bindLoadSwarmUntilCallback } from './websocket/load-swarm-until-handler.js'
import { bindMessageStatusChangeCallbacks } from './websocket/message-status-handler.js'
import { bindWebRtcCallbacks } from './websocket/webrtc-handler.js'

loadEnv()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDevMode = process.env.NODE_ENV === 'development' ? true : false
const adminAccount = Container.get(AdminAccount)

type CorsOriginCallback = (
  origin: string | undefined,
  callback: (err: Error | null, origin?: boolean | string | RegExp | Array<boolean | string | RegExp>) => void,
) => void

// Vite falls back to 3001, 3002, etc. when 3000 is already taken by another
// dev server, so dev mode must not hardcode a single port or the client
// silently loses all API access (requests "succeed" but the browser blocks
// the response due to the missing CORS header).
const DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/

function getAllowedCorsOrigins(): string[] | RegExp {
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins
  }

  return isDevMode ? DEV_ORIGIN_PATTERN : []
}

function getClientDistPath(): string {
  const candidates = [path.join(__dirname, '../client/dist'), path.join(__dirname, '../../client/dist')]
  const clientDistPath = candidates.find((candidate) => existsSync(path.join(candidate, 'index.html')))
  if (!clientDistPath) {
    throw new Error('Client build not found. Run npm run build before starting Jami Web in production mode.')
  }
  return clientDistPath
}

@Service()
export class App {
  app = express()

  constructor() {
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            connectSrc: ["'self'", 'ws:', 'wss:'],
            upgradeInsecureRequests: null,
          },
        },
      }),
    )
    const allowedCorsOrigins = getAllowedCorsOrigins()
    const isOriginAllowed = (origin: string) =>
      allowedCorsOrigins instanceof RegExp ? allowedCorsOrigins.test(origin) : allowedCorsOrigins.includes(origin)
    const corsOrigin: CorsOriginCallback = (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true)
        return
      }

      callback(null, false)
    }
    const corsOptions: CorsOptions = {
      origin: corsOrigin,
    }
    this.app.use(cors(corsOptions))
    this.app.use(json())

    const apiRouter = express.Router()
    this.app.use('/api', apiRouter)

    // Enforce admin setup
    apiRouter.use('/admin', adminRouter)

    // Setup routing
    apiRouter.use('/auth', authRouter)
    apiRouter.use('/account', accountRouter)
    apiRouter.use('/contacts', contactsRouter)
    apiRouter.use('/presence', presenceRouter)
    apiRouter.use('/default-moderators', defaultModeratorsRouter)
    apiRouter.use('/conversations', conversationRouter)
    apiRouter.use('/conversation-requests', conversationRequestRouter)
    apiRouter.use('/calls', callRouter)
    apiRouter.use('/link-preview', linkPreviewRouter)
    apiRouter.use('/ns', nameserverRouter)
    apiRouter.use('/data', dataTransferRouter)
    apiRouter.use('/config', configRouter)
    apiRouter.use('/tokens', tokenRouter)
    apiRouter.use('/passkey', passkeyRouter)

    if (!isDevMode) {
      const clientDistPath = getClientDistPath()

      // Serve static files from the client
      this.app.use(express.static(clientDistPath, { index: false }))

      this.app.get('/{*path}', (req, res) => {
        if (!isElectronMode) {
          const redirectPath = getAdminSetupRedirect(req.path, adminAccount.getLastWizardState())
          if (redirectPath) {
            res.redirect(redirectPath)
            return
          }
        }

        res.sendFile(path.join(clientDistPath, 'index.html'))
      })
    }

    // Setup WebSocket callbacks
    bindChatCallbacks()
    bindWebRtcCallbacks()
    bindMessageStatusChangeCallbacks()
    bindReactionAddedCallBack()
    bindReactionRemovedCallBack()
    bindLoadMoreMessagesCallBack()
    bindLoadSwarmUntilCallback()

    // Setup 404 error handling
    this.app.use((_req, res) => {
      res.sendStatus(HttpStatusCode.NotFound)
    })

    // Setup internal error handling
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      log.error(err)
      res.status(HttpStatusCode.InternalServerError).send(err.message)
    })
  }
}
