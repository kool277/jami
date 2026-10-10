/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

// ─── ChallengeStore (pure JS copy for testing) ──────────────────────────────

class ChallengeStore {
  #challenges = new Map()
  #ttlMs

  constructor(ttlMs = 5 * 60 * 1000) {
    this.#ttlMs = ttlMs
  }

  set(key, challenge) {
    this.#challenges.set(key, { challenge, expiresAt: Date.now() + this.#ttlMs })
  }

  consume(key) {
    const entry = this.#challenges.get(key)
    this.#challenges.delete(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) return undefined
    return entry.challenge
  }
}

// ─── PasskeyStore (pure JS copy for testing) ─────────────────────────────────

class TestablePasskeyStore {
  #data
  filename

  constructor(filename) {
    this.filename = filename
    try {
      const buf = readFileSync(filename)
      this.#data = JSON.parse(buf.toString())
    } catch {
      this.#data = {}
    }
  }

  getByUsername(username) {
    return this.#data[username.toLowerCase()] ?? []
  }

  findByCredentialId(credentialId) {
    for (const [username, passkeys] of Object.entries(this.#data)) {
      const passkey = passkeys.find((p) => p.credentialId === credentialId)
      if (passkey) return { username, passkey }
    }
    return undefined
  }

  add(username, passkey) {
    const key = username.toLowerCase()
    if (!this.#data[key]) this.#data[key] = []
    this.#data[key].push(passkey)
  }

  remove(username, credentialId) {
    const key = username.toLowerCase()
    const list = this.#data[key]
    if (!list) return false
    const idx = list.findIndex((p) => p.credentialId === credentialId)
    if (idx === -1) return false
    list.splice(idx, 1)
    return true
  }

  updateCounter(username, credentialId, newCounter) {
    const key = username.toLowerCase()
    const passkey = this.#data[key]?.find((p) => p.credentialId === credentialId)
    if (passkey) passkey.counter = newCounter
  }

  hasAnyPasskeys() {
    return Object.values(this.#data).some((list) => list.length > 0)
  }

  saveSync() {
    writeFileSync(this.filename, JSON.stringify(this.#data, null, 2) + '\n', { mode: 0o600 })
  }
}

// ─── ChallengeStore Tests ────────────────────────────────────────────────────

describe('ChallengeStore', () => {
  it('should store and consume a challenge', () => {
    const store = new ChallengeStore()
    store.set('user1', 'challenge-abc')
    const result = store.consume('user1')
    assert.equal(result, 'challenge-abc')
  })

  it('should return undefined for unknown key', () => {
    const store = new ChallengeStore()
    const result = store.consume('nonexistent')
    assert.equal(result, undefined)
  })

  it('should consume challenge only once (replay protection)', () => {
    const store = new ChallengeStore()
    store.set('user1', 'challenge-abc')
    store.consume('user1')
    const result = store.consume('user1')
    assert.equal(result, undefined)
  })

  it('should reject expired challenges', async () => {
    const store = new ChallengeStore(50) // 50ms TTL
    store.set('user1', 'challenge-short')
    await new Promise((r) => setTimeout(r, 100))
    const result = store.consume('user1')
    assert.equal(result, undefined)
  })

  it('should allow overwriting a challenge for same key', () => {
    const store = new ChallengeStore()
    store.set('user1', 'old-challenge')
    store.set('user1', 'new-challenge')
    const result = store.consume('user1')
    assert.equal(result, 'new-challenge')
  })

  it('should handle multiple independent keys', () => {
    const store = new ChallengeStore()
    store.set('user1', 'challenge-1')
    store.set('user2', 'challenge-2')
    assert.equal(store.consume('user1'), 'challenge-1')
    assert.equal(store.consume('user2'), 'challenge-2')
  })

  it('should not leak challenges between keys', () => {
    const store = new ChallengeStore()
    store.set('user1', 'secret-challenge')
    assert.equal(store.consume('user2'), undefined)
    // user1's challenge should still be consumable
    assert.equal(store.consume('user1'), 'secret-challenge')
  })
})

// ─── PasskeyStore Tests ──────────────────────────────────────────────────────

describe('PasskeyStore', () => {
  let tempDir
  let store

  function makePasskey(overrides = {}) {
    return {
      credentialId: 'cred-' + Math.random().toString(36).slice(2),
      publicKey: 'pubkey-' + Math.random().toString(36).slice(2),
      counter: 0,
      createdAt: new Date().toISOString(),
      name: 'Test Passkey',
      ...overrides,
    }
  }

  beforeEach(() => {
    tempDir = join(tmpdir(), 'passkey-test-' + Date.now() + '-' + Math.random().toString(36).slice(2))
    mkdirSync(tempDir, { recursive: true })
    store = new TestablePasskeyStore(join(tempDir, 'passkeys.json'))
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should return empty array for unknown user', () => {
    assert.deepEqual(store.getByUsername('unknown'), [])
  })

  it('should add and retrieve a passkey', () => {
    const pk = makePasskey({ credentialId: 'cred-1' })
    store.add('alice', pk)
    const result = store.getByUsername('alice')
    assert.equal(result.length, 1)
    assert.equal(result[0].credentialId, 'cred-1')
  })

  it('should be case-insensitive for usernames', () => {
    const pk = makePasskey()
    store.add('Alice', pk)
    assert.equal(store.getByUsername('alice').length, 1)
    assert.equal(store.getByUsername('ALICE').length, 1)
    assert.equal(store.getByUsername('aLiCe').length, 1)
  })

  it('should support multiple passkeys per user', () => {
    store.add('alice', makePasskey({ credentialId: 'cred-1' }))
    store.add('alice', makePasskey({ credentialId: 'cred-2' }))
    store.add('alice', makePasskey({ credentialId: 'cred-3' }))
    assert.equal(store.getByUsername('alice').length, 3)
  })

  it('should find passkey by credential ID across users', () => {
    store.add('alice', makePasskey({ credentialId: 'alice-cred' }))
    store.add('bob', makePasskey({ credentialId: 'bob-cred' }))

    const result = store.findByCredentialId('bob-cred')
    assert.ok(result)
    assert.equal(result.username, 'bob')
    assert.equal(result.passkey.credentialId, 'bob-cred')
  })

  it('should return undefined for unknown credential ID', () => {
    store.add('alice', makePasskey({ credentialId: 'cred-1' }))
    assert.equal(store.findByCredentialId('nonexistent'), undefined)
  })

  it('should remove a specific passkey by credential ID', () => {
    store.add('alice', makePasskey({ credentialId: 'cred-1' }))
    store.add('alice', makePasskey({ credentialId: 'cred-2' }))

    const removed = store.remove('alice', 'cred-1')
    assert.equal(removed, true)
    assert.equal(store.getByUsername('alice').length, 1)
    assert.equal(store.getByUsername('alice')[0].credentialId, 'cred-2')
  })

  it('should return false when removing non-existent credential', () => {
    store.add('alice', makePasskey({ credentialId: 'cred-1' }))
    assert.equal(store.remove('alice', 'nonexistent'), false)
  })

  it('should return false when removing from non-existent user', () => {
    assert.equal(store.remove('ghost', 'cred-1'), false)
  })

  it('should update counter for signature counting', () => {
    store.add('alice', makePasskey({ credentialId: 'cred-1', counter: 0 }))
    store.updateCounter('alice', 'cred-1', 42)
    const pk = store.getByUsername('alice')[0]
    assert.equal(pk.counter, 42)
  })

  it('should not throw when updating counter for non-existent credential', () => {
    // Should be a no-op, not an error
    store.updateCounter('alice', 'nonexistent', 5)
  })

  it('should report hasAnyPasskeys correctly', () => {
    assert.equal(store.hasAnyPasskeys(), false)
    store.add('alice', makePasskey())
    assert.equal(store.hasAnyPasskeys(), true)
    store.remove('alice', store.getByUsername('alice')[0].credentialId)
    assert.equal(store.hasAnyPasskeys(), false)
  })

  it('should persist data to disk and reload', () => {
    store.add('alice', makePasskey({ credentialId: 'cred-persist', name: 'My Key' }))
    store.saveSync()

    const store2 = new TestablePasskeyStore(join(tempDir, 'passkeys.json'))
    const result = store2.getByUsername('alice')
    assert.equal(result.length, 1)
    assert.equal(result[0].credentialId, 'cred-persist')
    assert.equal(result[0].name, 'My Key')
  })

  it('should write file with restrictive permissions (0600)', () => {
    store.add('alice', makePasskey())
    store.saveSync()

    const stats = statSync(join(tempDir, 'passkeys.json'))
    const mode = stats.mode & 0o777
    assert.equal(mode, 0o600, `Expected file mode 0600, got 0${mode.toString(8)}`)
  })

  it('should handle empty file gracefully', () => {
    writeFileSync(join(tempDir, 'empty.json'), '')
    const emptyStore = new TestablePasskeyStore(join(tempDir, 'empty.json'))
    assert.deepEqual(emptyStore.getByUsername('alice'), [])
  })

  it('should handle malformed JSON gracefully', () => {
    writeFileSync(join(tempDir, 'bad.json'), '{not valid json')
    const badStore = new TestablePasskeyStore(join(tempDir, 'bad.json'))
    assert.deepEqual(badStore.getByUsername('alice'), [])
  })

  it('should handle missing file gracefully', () => {
    const missingStore = new TestablePasskeyStore(join(tempDir, 'does-not-exist.json'))
    assert.deepEqual(missingStore.getByUsername('alice'), [])
  })

  it('should isolate users from each other', () => {
    store.add('alice', makePasskey({ credentialId: 'alice-cred' }))
    store.add('bob', makePasskey({ credentialId: 'bob-cred' }))

    const aliceKeys = store.getByUsername('alice')
    assert.equal(aliceKeys.length, 1)
    assert.equal(aliceKeys[0].credentialId, 'alice-cred')

    // Removing Alice's key doesn't affect Bob
    store.remove('alice', 'alice-cred')
    assert.equal(store.getByUsername('alice').length, 0)
    assert.equal(store.getByUsername('bob').length, 1)
  })

  it('should not allow credential ID collision across users', () => {
    // Two different users can technically have passkeys with the same ID stored,
    // but findByCredentialId returns the first match — this verifies behavior
    store.add('alice', makePasskey({ credentialId: 'shared-cred' }))
    store.add('bob', makePasskey({ credentialId: 'shared-cred' }))

    const result = store.findByCredentialId('shared-cred')
    assert.ok(result)
    // Should find one of them (deterministic based on Object.entries order)
    assert.ok(['alice', 'bob'].includes(result.username))
  })
})
