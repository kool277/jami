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
import { describe, expect, it } from 'vitest'

import { Contact } from './contact.js'

describe('Contact', () => {
  it('keeps the display name sent by the server', () => {
    const contact = Contact.fromInterface({
      uri: 'contact-uri',
      registeredName: 'registered',
      displayName: 'Display Name',
    })

    expect(contact.getDisplayName()).toBe('Display Name')
  })

  it('falls back to the registered name then the uri', () => {
    expect(Contact.fromInterface({ uri: 'contact-uri', registeredName: 'registered' }).getDisplayName()).toBe(
      'registered',
    )
    expect(Contact.fromInterface({ uri: 'contact-uri' }).getDisplayName()).toBe('contact-uri')
  })
})
