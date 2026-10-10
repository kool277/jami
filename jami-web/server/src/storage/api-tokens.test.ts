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
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

const dataDir = mkdtempSync(join(tmpdir(), 'jami-web-api-tokens-'))
process.env.JAMI_WEB_DATA_DIR = dataDir

let ApiTokenStore: typeof import('./api-tokens.js').ApiTokenStore

before(async () => {
  const tokenStoreModule = './api-tokens.js?token-store-test'
  ;({ ApiTokenStore } = await import(tokenStoreModule))
})

after(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

function readStore() {
  return JSON.parse(readFileSync(join(dataDir, 'api-tokens.json'), 'utf8'))
}

describe('ApiTokenStore persistence', () => {
  it('leaves a parsable file behind when saves overlap', async () => {
    const store = new ApiTokenStore()
    for (let i = 0; i < 20; i++) {
      store.createToken('account-1', `token-${i}`, ['account:read'])
    }

    await Promise.all(Array.from({ length: 25 }, () => store.save()))

    assert.equal(readStore().tokens.length, 20)
    assert.deepEqual(
      readdirSync(dataDir).filter((entry) => entry !== 'api-tokens.json'),
      [],
      'temporary files must not be left behind',
    )
  })

  it('does not rewrite the whole store on every token validation', async () => {
    const store = new ApiTokenStore()
    const { token } = store.createToken('account-1', 'hot-path', ['account:read'])
    await store.save()

    let writes = 0
    const save = store.save.bind(store)
    store.save = async () => {
      writes += 1
      await save()
    }

    for (let i = 0; i < 50; i++) {
      assert.ok(store.validateToken(token))
      store.recordUsage()
    }

    assert.equal(writes, 0, 'recording usage must not trigger a synchronous full-store write')
    await store.flushUsage()
    assert.ok(readStore().tokens.some((stored: { lastUsedAt?: string }) => stored.lastUsedAt !== undefined))
  })
})
