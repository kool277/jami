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
import { AccountDetails } from '@savoirfairelinux/jami-web-common'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { RegistrationState } from '../jamid/state-enums.js'
import { Accounts } from '../storage/accounts.js'
import { AdminAccount } from '../storage/admin-account.js'
import { ApiTokenStore } from '../storage/api-tokens.js'
import { hashPassword } from '../utils/password.js'
import { getBotOwner } from '../utils/vCard.js'

export interface CliAccountSummary {
  accountId: string
  hash: string
  displayName: string
  registeredName: string
  botOwner?: string
}

export interface CliCreateAccountPayload {
  displayName: string
  password: string
}

export interface CliCreateAccountResult {
  displayName: string
  accountId: string
  accountHash: string
}

export interface CliRemoveAccountResult {
  accountId: string
}

export interface CliCreateBotPayload {
  displayName: string
  owner: string
}

export interface CliCreateBotResult {
  displayName: string
  ownerHash: string
  accountId: string
  botHash: string
  token: string
  tokenId: string
  tokenPrefix: string
}

interface OwnerAccount {
  accountId: string
  hash: string
  displayName: string
  registeredName: string
}

const jamid = Container.get(Jamid)
const accountsStore = Container.get(Accounts)
const adminAccount = Container.get(AdminAccount)
const tokenStore = Container.get(ApiTokenStore)

function getBotHash(details: AccountDetails): string | undefined {
  const hash = details['Account.username']
  return hash && hash !== 'undefined' ? hash : undefined
}

function toOwnerAccount(accountId: string): OwnerAccount | null {
  const details = jamid.getAccountDetails(accountId)
  const hash = details['Account.username']
  if (!hash) {
    return null
  }

  let registeredName: string
  try {
    registeredName = jamid.getVolatileAccountDetails(accountId)['Account.registeredName'] ?? ''
  } catch {
    registeredName = ''
  }

  return {
    accountId,
    hash,
    displayName: details['Account.displayName'] ?? '',
    registeredName,
  }
}

function findOwner(accounts: OwnerAccount[], owner: string): OwnerAccount | undefined {
  const normalizedOwner = owner.toLowerCase()
  return accounts.find((account) => {
    return (
      account.accountId.toLowerCase() === normalizedOwner ||
      account.hash.toLowerCase() === normalizedOwner ||
      account.displayName.toLowerCase() === normalizedOwner ||
      account.registeredName.toLowerCase() === normalizedOwner
    )
  })
}

export async function listCliAccounts(): Promise<CliAccountSummary[]> {
  const listedAccounts = await Promise.all(
    jamid.getAccountIds().map(async (accountId) => {
      const details = jamid.getAccountDetails(accountId)
      const hash = details['Account.username']
      if (!hash) {
        return undefined
      }

      let registeredName: string
      try {
        registeredName = jamid.getVolatileAccountDetails(accountId)['Account.registeredName'] ?? ''
      } catch {
        registeredName = ''
      }

      return {
        accountId,
        hash,
        displayName: details['Account.displayName'] ?? '',
        registeredName,
        botOwner: await getBotOwner(accountId),
      } as CliAccountSummary
    }),
  )

  return listedAccounts.filter((account): account is CliAccountSummary => account !== undefined)
}

export async function createCliAccount(payload: CliCreateAccountPayload): Promise<CliCreateAccountResult> {
  if (!adminAccount.getConfig().localAuthEnabled) {
    throw new Error('Local authentication is disabled')
  }

  const accountDetails = payload.displayName ? { 'Account.displayName': payload.displayName } : {}
  const registration = await jamid.addAccount(accountDetails)

  if (registration.state === RegistrationState.ErrorGeneric) {
    jamid.removeAccount(registration.accountId)
    throw new Error('Failed to create the Jami account')
  }

  const details = jamid.getAccountDetails(registration.accountId)
  const accountHash = details['Account.username']
  if (!accountHash) {
    jamid.removeAccount(registration.accountId)
    throw new Error('The Jami account was created, but its hash could not be read')
  }

  const hashedPassword = await hashPassword(payload.password)
  accountsStore.set(accountHash, hashedPassword, 'local', registration.accountId)
  await accountsStore.save()

  return {
    displayName: payload.displayName,
    accountId: registration.accountId,
    accountHash,
  }
}

export async function removeCliAccount(accountId: string): Promise<CliRemoveAccountResult> {
  const account = (await listCliAccounts()).find((value) => value.accountId === accountId)
  if (!account) {
    throw new Error(`Account not found: ${accountId}`)
  }

  jamid.removeAccount(accountId)
  if (tokenStore.revokeAllTokens(accountId)) {
    await tokenStore.save()
  }

  if (accountsStore.removeByAccountId(accountId)) {
    await accountsStore.save()
  }

  return { accountId }
}

export async function createCliBot(payload: CliCreateBotPayload): Promise<CliCreateBotResult> {
  const owners = jamid
    .getAccountIds()
    .map((accountId) => toOwnerAccount(accountId))
    .filter((account): account is OwnerAccount => account !== null)

  if (owners.length === 0) {
    throw new Error('No Jami accounts are available. Create an account first.')
  }

  const owner = findOwner(owners, payload.owner)
  if (!owner) {
    throw new Error(`Owner account not found: ${payload.owner}`)
  }

  const registration = await jamid.addAccount({ 'Account.displayName': payload.displayName })

  if (registration.state === RegistrationState.ErrorGeneric) {
    jamid.removeAccount(registration.accountId)
    throw new Error('Failed to create the Jami bot account')
  }

  let botHash: string | undefined
  try {
    jamid.updateProfile(registration.accountId, payload.displayName, '', '', owner.hash, 10)
    const details = jamid.getAccountDetails(registration.accountId)
    botHash = getBotHash(details)
  } catch (error) {
    jamid.removeAccount(registration.accountId)
    throw error
  }

  if (!botHash) {
    jamid.removeAccount(registration.accountId)
    throw new Error('The Jami bot account was created, but its hash could not be read')
  }

  const { token, info } = tokenStore.createToken(registration.accountId, payload.displayName)
  await tokenStore.save()

  return {
    displayName: payload.displayName,
    ownerHash: owner.hash,
    accountId: registration.accountId,
    botHash,
    token,
    tokenId: info.id,
    tokenPrefix: info.prefix,
  }
}
