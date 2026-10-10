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
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import { Container, Service } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { dataDir } from '../utils/env.js'

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

interface AccountsFormat {
  local: Record<string, { password: string; accountId: string }>
  jams: Record<string, { password: string; accountId: string }>
  pendingImports: Record<string, string>
  guest: Record<string, string> // key is accountId, value is expiration date
  openid: Record<
    string,
    {
      accountId: string
      service: string[]
    }
  >
}

interface PersistedAccountsFormat extends AccountsFormat {
  sessionsInvalidAfter?: Record<string, number>
}

const METHODS = ['local', 'jams', 'guest', 'openid']

@Service()
export class Accounts {
  private readonly filename = dataDir + '/accounts.json'
  private accounts: AccountsFormat
  private sessionsInvalidAfter: Record<string, number>
  private jamidInstance: Jamid | null = null // Lazy initialization
  private accountsIds: Set<string>

  constructor() {
    let buffer: Buffer
    try {
      buffer = readFileSync(this.filename)
    } catch (e) {
      buffer = Buffer.from(
        '{"local":{},"jams":{},"sessionsInvalidAfter":{},"guest":{},"openid":{},"pendingImports":{}}',
      )
    }
    const persistedAccounts: PersistedAccountsFormat = JSON.parse(buffer.toString())
    this.sessionsInvalidAfter = persistedAccounts.sessionsInvalidAfter ?? {}
    delete persistedAccounts.sessionsInvalidAfter
    this.accounts = persistedAccounts

    this.accountsIds = new Set<string>()
    // add the accountIds to the set
    for (const accId of Object.keys(this.accounts.guest)) {
      this.accountsIds.add(accId)
    }
    for (const key of Object.keys(this.accounts.jams)) {
      this.accountsIds.add(this.accounts.jams[key].accountId)
    }
    for (const key of Object.keys(this.accounts.local)) {
      this.accountsIds.add(this.accounts.local[key].accountId)
    }
    for (const key of Object.keys(this.accounts.openid)) {
      this.accountsIds.add(this.accounts.openid[key].accountId)
    }
  }

  private get jamid() {
    if (!this.jamidInstance) {
      this.jamidInstance = Container.get(Jamid)
    }
    return this.jamidInstance
  }

  get(username: string, authMethod: string = 'local') {
    if (!METHODS.includes(authMethod)) {
      console.log('Invalid auth method')
      return
    }
    if (!(authMethod in this.accounts)) {
      this.accounts[authMethod as keyof AccountsFormat] = {}
    }
    return this.accounts[authMethod as keyof AccountsFormat][username.toLowerCase()]
  }

  getOpenIdAccount(key: string) {
    return this.accounts['openid'][key.toLowerCase()]
  }

  isInJamsAccounts(username: string) {
    return username.toLowerCase() in this.accounts['jams']
  }

  set(username: string, value: string | string[], authMethod: string = 'local', accountId: string): void {
    if (!METHODS.includes(authMethod)) {
      console.log('Invalid auth method')
      return
    }

    if (!(authMethod in this.accounts)) {
      this.accounts[authMethod as keyof AccountsFormat] = {}
    }

    try {
      switch (authMethod) {
        case 'jams':
          if (accountId !== undefined && typeof value === 'string') {
            this.accounts['jams'][username.toLowerCase()] = {
              password: value,
              accountId: accountId,
            }
          } else {
            throw new Error('JAMSAccountId is required for jams auth method')
          }
          break
        case 'local':
          if (typeof value !== 'string') {
            return
          }
          this.accounts['local'][username.toLowerCase()] = {
            password: value,
            accountId: accountId,
          }
          break
        case 'guest':
          if (typeof value !== 'string') {
            return
          }
          this.accounts['guest'][username.toLowerCase()] = value
          break
        case 'openid':
          if (typeof value === 'string') {
            return
          }
          this.accounts['openid'][username.toLowerCase()] = {
            service: value,
            accountId: accountId,
          }

          break
        default:
          throw new Error('Invalid auth method')
      }
      this.accountsIds.add(accountId)
    } catch (e) {
      console.log(e)
    }
  }

  getAll(): AccountsFormat {
    return this.accounts
  }

  getLocalByAccountId(accountId: string) {
    return Object.values(this.accounts.local).find((account) => account.accountId === accountId)
  }

  updateLocalPassword(accountId: string, password: string): boolean {
    const account = this.getLocalByAccountId(accountId)
    if (!account) {
      return false
    }

    account.password = password
    return true
  }

  setSessionsInvalidAfter(accountId: string): void {
    this.sessionsInvalidAfter[accountId] = Date.now() / 1000
  }

  isSessionValid(accountId: string, issuedAt: unknown): boolean {
    const invalidAfter = this.sessionsInvalidAfter[accountId]
    return invalidAfter === undefined || (typeof issuedAt === 'number' && issuedAt > invalidAfter)
  }

  removeByAccountId(accountId: string): boolean {
    let removed = false

    const authMethods: Array<'local' | 'jams' | 'openid'> = ['local', 'jams', 'openid']
    for (const authMethod of authMethods) {
      const entries = this.accounts[authMethod]
      for (const [username, account] of Object.entries(entries)) {
        if (account.accountId !== accountId) {
          continue
        }
        delete entries[username]
        removed = true
      }
    }

    if (accountId in this.accounts.guest) {
      delete this.accounts.guest[accountId]
      removed = true
    }

    if (this.accounts.pendingImports && accountId in this.accounts.pendingImports) {
      delete this.accounts.pendingImports[accountId]
      removed = true
    }

    this.accountsIds.delete(accountId)
    delete this.sessionsInvalidAfter[accountId]
    return removed
  }

  remove(username: string, authMethod: string) {
    if (!METHODS.includes(authMethod)) {
      console.log('Invalid auth method')
      return
    }
    if (!(authMethod in this.accounts)) {
      this.accounts[authMethod as keyof AccountsFormat] = {}
      return
    }

    const account = this.accounts[authMethod as keyof AccountsFormat][username.toLowerCase()]
    if (typeof account !== 'string') {
      this.accountsIds.delete(account.accountId)
    } else {
      // guest removal
      this.accountsIds.delete(username)
    }

    delete this.accounts[authMethod as keyof AccountsFormat][username.toLowerCase()]
    if (typeof account !== 'string') {
      delete this.sessionsInvalidAfter[account.accountId]
    }
  }

  isInPendingAccounts(accountId: string) {
    if (this.accounts.pendingImports === undefined) {
      this.accounts.pendingImports = {}
    }
    return accountId in this.accounts.pendingImports
  }

  getPendingAccounts() {
    if (!this.accounts.pendingImports) {
      this.accounts.pendingImports = {}
    }

    return this.accounts.pendingImports
  }

  removeAndDeletePendingAccount(accountId: string) {
    this.removePendingAccount(accountId)
    this.jamid.removeAccount(accountId)
  }

  removePendingAccount(accountId: string) {
    if (!this.accounts.pendingImports) {
      this.accounts.pendingImports = {}
      return
    }
    delete this.accounts.pendingImports[accountId]
  }

  addPendingAccount(accountId: string) {
    if (!this.accounts.pendingImports) {
      this.accounts.pendingImports = {}
    }
    this.accounts.pendingImports[accountId] = accountId
  }

  extendSessionIfGuest(accountId: string) {
    if (!(accountId in this.accounts.guest)) {
      return
    }
    const guestExpiration = this.accounts.guest[accountId]
    if (guestExpiration === undefined) {
      return
    }
    const expiration = new Date(guestExpiration)
    expiration.setHours(expiration.getHours() + 2)
  }

  getGuests() {
    return this.accounts.guest
  }

  isValidAccountId(accountId: string) {
    return this.accountsIds.has(accountId)
  }

  async save(): Promise<void> {
    await writeFile(
      this.filename,
      JSON.stringify({ ...this.accounts, sessionsInvalidAfter: this.sessionsInvalidAfter }, null, 2) + '\n',
    )
  }
}
