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
import { describe, it } from 'node:test'

import { toStringRecord } from './string-record.js'

describe('toStringRecord', () => {
  it('converts a map into a JSON-serialisable record', () => {
    const record = toStringRecord(
      new Map([
        ['peer_id', 'peer-1'],
        ['auth_scheme', 'password'],
      ]),
    )

    assert.deepEqual(record, { ['peer_id']: 'peer-1', ['auth_scheme']: 'password' })
    assert.equal(JSON.stringify(record), '{"peer_id":"peer-1","auth_scheme":"password"}')
  })

  it('keeps a plain object unchanged', () => {
    assert.deepEqual(toStringRecord({ error: 'network' }), { error: 'network' })
  })

  it('returns an empty record when the daemon reports no details', () => {
    assert.deepEqual(toStringRecord(undefined), {})
  })
})
