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
import { afterEach, describe, it, mock } from 'node:test'

describe('CLI control client', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('preserves a socket connection error as the API request error cause', async () => {
    const connectionError = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })
    let requestCount = 0
    const request = {
      on(event: string, listener: (error: Error) => void) {
        if (requestCount === 2 && event === 'error') {
          queueMicrotask(() => listener(connectionError))
        }
        return request
      },
      write() {},
      end() {},
    }

    mock.module('node:http', {
      namedExports: {
        request: (_options: unknown, onResponse: (response: unknown) => void) => {
          requestCount += 1
          if (requestCount === 1) {
            const healthResponse = {
              statusCode: 204,
              setEncoding() {},
              on(event: string, listener: () => void) {
                if (event === 'end') {
                  queueMicrotask(listener)
                }
                return healthResponse
              },
            }
            queueMicrotask(() => onResponse(healthResponse))
          }
          return request
        },
      },
    })
    mock.module('../../utils/runtime.js', {
      namedExports: {
        resolveRuntimeSettings: () => ({ cliControlSocketPath: '/tmp/jami-web-test.sock' }),
      },
    })

    const client = await import(`./client.ts?case=${Date.now()}-${Math.random()}`)

    await assert.rejects(
      () => client.listCliAccountsRequest(),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.cause, connectionError)
        return true
      },
    )
  })
})
