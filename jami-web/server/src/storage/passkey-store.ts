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
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

import { Service } from 'typedi'

import { dataDir } from '../utils/env.js'

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

export interface StoredPasskey {
  credentialId: string // base64url-encoded credential ID
  publicKey: string // base64url-encoded public key
  counter: number
  transports?: AuthenticatorTransport[]
  createdAt: string // ISO date
  name: string // user-provided label
}

/** username (lowercase) → array of passkeys */
type PasskeyData = Record<string, StoredPasskey[]>

/**
 * In-memory + file-backed store for WebAuthn/passkey credentials.
 * Each local user can register multiple passkeys.
 */
@Service()
export class PasskeyStore {
  private readonly filename = dataDir + '/passkeys.json'
  private data: PasskeyData

  constructor() {
    try {
      const buf = readFileSync(this.filename)
      this.data = JSON.parse(buf.toString())
    } catch {
      this.data = {}
    }
  }

  /** All passkeys for a given username */
  getByUsername(username: string): StoredPasskey[] {
    return this.data[username.toLowerCase()] ?? []
  }

  /** Find which username owns a given credential ID */
  findByCredentialId(credentialId: string): { username: string; passkey: StoredPasskey } | undefined {
    for (const [username, passkeys] of Object.entries(this.data)) {
      const passkey = passkeys.find((p) => p.credentialId === credentialId)
      if (passkey) return { username, passkey }
    }
    return undefined
  }

  add(username: string, passkey: StoredPasskey): void {
    const key = username.toLowerCase()
    if (!this.data[key]) this.data[key] = []
    this.data[key].push(passkey)
  }

  remove(username: string, credentialId: string): boolean {
    const key = username.toLowerCase()
    const list = this.data[key]
    if (!list) return false
    const idx = list.findIndex((p) => p.credentialId === credentialId)
    if (idx === -1) return false
    list.splice(idx, 1)
    return true
  }

  removeAll(username: string): boolean {
    const key = username.toLowerCase()
    if (!this.data[key]) return false
    delete this.data[key]
    return true
  }

  updateCounter(username: string, credentialId: string, newCounter: number): void {
    const key = username.toLowerCase()
    const passkey = this.data[key]?.find((p) => p.credentialId === credentialId)
    if (passkey) passkey.counter = newCounter
  }

  /** Returns true if any user has at least one passkey registered */
  hasAnyPasskeys(): boolean {
    return Object.values(this.data).some((list) => list.length > 0)
  }

  async save(): Promise<void> {
    await writeFile(this.filename, JSON.stringify(this.data, null, 2) + '\n', { mode: 0o600 })
  }
}
