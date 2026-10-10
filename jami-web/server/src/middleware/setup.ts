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
import { HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { NextFunction, Request, Response } from 'express'
import { Container } from 'typedi'

import { AdminAccount } from '../storage/admin-account.js'
import { isElectronMode } from '../utils/electron.js'

const adminAccount = Container.get(AdminAccount)

export async function checkAdminSetup(_req: Request, res: Response, next: NextFunction) {
  if (isElectronMode) {
    next()
    return
  }

  const isSetupComplete = adminAccount.getPasswordHash() !== undefined

  if (!isSetupComplete) {
    res.status(HttpStatusCode.Forbidden).send('Setup not complete')
    return
  }

  next()
}
