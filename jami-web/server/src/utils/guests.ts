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

import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { Accounts } from '../storage/accounts.js'

const jamid = Container.get(Jamid)
const accounts = Container.get(Accounts)

export function clearGuest(accId: string) {
  const guests = accounts.getGuests()
  if (guests[accId] !== undefined) {
    const date = Number(guests[accId])
    if (date < Date.now()) {
      jamid.removeAccount(accId)
      accounts.remove(accId, 'guest')
      accounts.save()
      return
    }
    setTimeout(() => clearGuest(accId), date - Date.now()).unref()
  }
}

export function clearGuests() {
  const guests = accounts.getGuests()
  for (const accId in guests) {
    clearGuest(accId)
  }
}
