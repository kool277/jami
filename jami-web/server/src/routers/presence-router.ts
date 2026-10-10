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
import { Router } from 'express'
import { Container } from 'typedi'

import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'
import { PresenceService } from '../services/PresenceService.js'

const presenceService = Container.get(PresenceService)
export const presenceRouter = Router()

presenceRouter.use(authenticateToken)
presenceRouter.use(extendIfGuest)
presenceRouter.use(requireApiTokenScope('contacts'))

presenceRouter.get('/', (_req, res) => {
  res.send(presenceService.getStatuses(res.locals.accountId))
})
