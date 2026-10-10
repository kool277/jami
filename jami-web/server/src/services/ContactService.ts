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

import { IContact } from '@savoirfairelinux/jami-web-common'
import { Container, Service } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { getDisplayName } from '../utils/vCard.js'

const jamid = Container.get(Jamid)

@Service()
export class ContactService {
  async getContactFromUri(accountId: string, contactUri: string): Promise<IContact> {
    const displayName = await getDisplayName(accountId, contactUri)
    try {
      const { name } = await jamid.lookupAddress(contactUri, '', accountId)
      return {
        uri: contactUri,
        registeredName: name,
        displayName,
      }
    } catch (e) {
      return {
        uri: contactUri,
        registeredName: contactUri,
        displayName,
      }
    }
  }
}
