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
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { PresenceService } from './PresenceService.js'

const subscribeBuddy = mock.fn()
const getSubscriptions = mock.fn((_accountId: string): Record<string, string>[] => [])

beforeEach(() => {
  subscribeBuddy.mock.resetCalls()
  getSubscriptions.mock.resetCalls()
  getSubscriptions.mock.mockImplementation(() => [])
  Container.set(Jamid, { subscribeBuddy, getSubscriptions })
})

afterEach(() => {
  Container.remove(Jamid)
})

describe('PresenceService', () => {
  it('subscribes a buddy only once', () => {
    const service = new PresenceService()

    service.subscribe('account-id', 'bob')
    service.subscribe('account-id', 'bob')

    assert.deepEqual(
      subscribeBuddy.mock.calls.map((call) => call.arguments),
      [['account-id', 'bob', true]],
    )
  })

  it('reports the daemon subscription statuses as a snapshot', () => {
    getSubscriptions.mock.mockImplementation(() => [
      { Buddy: 'bob', Status: 'Online' },
      { Buddy: 'carol', Status: 'Offline' },
    ])
    const service = new PresenceService()

    assert.deepEqual(service.getStatuses('account-id'), { bob: 1, carol: 0 })
    assert.deepEqual(
      getSubscriptions.mock.calls.map((call) => call.arguments),
      [['account-id']],
    )
  })

  it('skips malformed subscription entries', () => {
    getSubscriptions.mock.mockImplementation(() => [
      { Status: 'Online' } as Record<string, string>,
      { Buddy: 'bob', Status: 'Online' },
    ])
    const service = new PresenceService()

    assert.deepEqual(service.getStatuses('account-id'), { bob: 1 })
  })

  it('stops tracking a buddy that is explicitly unsubscribed', () => {
    const service = new PresenceService()

    service.subscribe('account-id', 'bob')
    service.unsubscribe('account-id', 'bob')

    assert.deepEqual(
      subscribeBuddy.mock.calls.map((call) => call.arguments),
      [
        ['account-id', 'bob', true],
        ['account-id', 'bob', false],
      ],
    )

    // The buddy can be re-subscribed afterwards
    service.subscribe('account-id', 'bob')
    assert.equal(subscribeBuddy.mock.callCount(), 3)
  })
})
