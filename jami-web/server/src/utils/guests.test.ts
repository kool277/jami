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
import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it, mock } from 'node:test'

import { Container } from 'typedi'

const removedAccounts: string[] = []
const removedGuestRecords: Array<{ accountId: string; authMethod: string }> = []
let guests: Record<string, string>

class MockJamid {}
class MockAccounts {}

const jamid = {
  getAccountDetails: (accountId: string) => ({ 'Account.username': accountId }),
  removeAccount: (accountId: string) => {
    removedAccounts.push(accountId)
  },
}

const accounts = {
  getGuests: () => guests,
  remove: (accountId: string, authMethod: string) => {
    removedGuestRecords.push({ accountId, authMethod })
    delete guests[accountId]
  },
  save: () => undefined,
}

mock.module('../jamid/jamid.js', { namedExports: { Jamid: MockJamid } })
mock.module('../storage/accounts.js', { namedExports: { Accounts: MockAccounts } })

let clearGuest: (accountId: string) => void
let clearGuests: () => void

before(async () => {
  Container.set(MockJamid, jamid)
  Container.set(MockAccounts, accounts)
  const guestsModule = await import('./guests.js')
  clearGuest = guestsModule.clearGuest
  clearGuests = guestsModule.clearGuests
})

beforeEach(() => {
  guests = {}
  removedAccounts.length = 0
  removedGuestRecords.length = 0
})

after(() => {
  mock.restoreAll()
  Container.remove(MockJamid)
  Container.remove(MockAccounts)
})

describe('guest cleanup', () => {
  it('removes an expired guest stored by account ID', () => {
    guests['guest-account-1'] = String(Date.now() - 1)

    clearGuest('guest-account-1')

    assert.deepEqual(removedAccounts, ['guest-account-1'])
    assert.deepEqual(removedGuestRecords, [{ accountId: 'guest-account-1', authMethod: 'guest' }])
  })

  it('cleans expired guests when loading saved guest sessions', () => {
    guests['guest-account-1'] = String(Date.now() - 1)

    clearGuests()

    assert.deepEqual(removedAccounts, ['guest-account-1'])
    assert.deepEqual(removedGuestRecords, [{ accountId: 'guest-account-1', authMethod: 'guest' }])
  })
})
