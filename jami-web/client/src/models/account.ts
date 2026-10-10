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
import { AccountDetails, Devices, IAccount, VolatileDetails } from '@savoirfairelinux/jami-web-common'

import { Contact } from './contact.js'

export type AccountType = 'RING' | 'SIP'

export class Account implements IAccount {
  readonly id: string
  details: AccountDetails
  volatileDetails: VolatileDetails
  defaultModerators: Contact[] = []
  devices: Devices = {}
  canChangePassword: boolean
  contacts: Contact[] = []

  constructor(
    id: string,
    details: AccountDetails,
    volatileDetails: VolatileDetails,
    devices: Devices = {},
    canChangePassword = false,
  ) {
    this.id = id
    this.details = details
    this.volatileDetails = volatileDetails
    this.devices = devices
    this.canChangePassword = canChangePassword
  }

  static fromInterface(accountInterface: IAccount) {
    const account = new Account(
      accountInterface.id,
      accountInterface.details,
      accountInterface.volatileDetails,
      accountInterface.devices,
      accountInterface.canChangePassword,
    )
    account.defaultModerators = accountInterface.defaultModerators.map(Contact.fromInterface)
    return account
  }

  setDevices(devices: Devices) {
    this.devices = devices
  }

  setDetails(details: AccountDetails) {
    this.details = details
  }

  getType(): AccountType {
    return this.details['Account.type'] as AccountType
  }

  getUri() {
    return this.details['Account.username']
  }

  getRegisteredName() {
    return this.volatileDetails['Account.registeredName']
  }

  isRendezVous() {
    return this.details['Account.rendezVous'] === 'true'
  }

  isPublicIn() {
    return this.details['DHT.PublicInCalls'] === 'true'
  }

  updateDetails(details: Partial<AccountDetails>) {
    this.details = { ...this.details, ...details }
  }

  getDisplayUri() {
    return this.getRegisteredName() ?? this.getUri()
  }

  getDisplayName() {
    return this.details['Account.displayName'] || this.getDisplayUri()
  }

  getDisplayNameNoFallback() {
    return this.details['Account.displayName'] || this.getRegisteredName()
  }
}
