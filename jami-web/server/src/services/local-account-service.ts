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
import { AccountDetails, HttpStatusCode, MIN_PASSWORD_LENGTH } from '@savoirfairelinux/jami-web-common'

import { Jamid } from '../jamid/jamid.js'
import { NameRegistrationEndedState } from '../jamid/state-enums.js'
import { Accounts } from '../storage/accounts.js'
import { AdminAccount } from '../storage/admin-account.js'
import { hashPassword } from '../utils/password.js'

export class LocalAccountCreationError extends Error {
  constructor(
    readonly status: HttpStatusCode,
    message: string,
  ) {
    super(message)
  }
}

export async function createLocalAccount(
  username: unknown,
  password: unknown,
  dependencies: {
    accounts: Accounts
    config: AdminAccount
    jamid: Jamid
  },
): Promise<string> {
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new LocalAccountCreationError(HttpStatusCode.BadRequest, 'Missing username or password in body')
  }
  if (dependencies.accounts.get(username) !== undefined) {
    throw new LocalAccountCreationError(HttpStatusCode.Conflict, 'Username already exists locally')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new LocalAccountCreationError(
      HttpStatusCode.BadRequest,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    )
  }

  const accountDetails: Partial<AccountDetails> = {}
  const nameserver = dependencies.config.getNameServerAddress()
  if (nameserver !== '') {
    accountDetails['RingNS.uri'] = nameserver
  }

  const { accountId } = await dependencies.jamid.addAccount(accountDetails)
  let credentialAdded = false
  try {
    const state = await dependencies.jamid.registerUsername(accountId, username, '')
    if (state !== NameRegistrationEndedState.Success) {
      dependencies.jamid.removeAccount(accountId)
      switch (state) {
        case NameRegistrationEndedState.InvalidName:
          throw new LocalAccountCreationError(HttpStatusCode.BadRequest, 'Invalid username or password')
        case NameRegistrationEndedState.AlreadyTaken:
          throw new LocalAccountCreationError(HttpStatusCode.Conflict, 'Username already exists')
        default:
          throw new LocalAccountCreationError(HttpStatusCode.InternalServerError, 'Error registering username')
      }
    }

    dependencies.accounts.set(username, await hashPassword(password), 'local', accountId)
    credentialAdded = true
    await dependencies.accounts.save()
    return accountId
  } catch (error) {
    if (!(error instanceof LocalAccountCreationError)) {
      dependencies.jamid.removeAccount(accountId)
      if (credentialAdded) {
        dependencies.accounts.remove(username, 'local')
        await dependencies.accounts.save()
      }
    }
    throw error
  }
}
