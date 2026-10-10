/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { rename, unlink, writeFile } from 'node:fs/promises'

import { API_TOKEN_SCOPES, type ApiTokenInfo, type ApiTokenScope } from '@savoirfairelinux/jami-web-common'
import { Service } from 'typedi'

import { dataDir } from '../utils/env.js'

export { API_TOKEN_SCOPES }
export type TokenScope = ApiTokenScope

export const MAX_API_TOKEN_NAME_LENGTH = 100
export const MAX_API_TOKEN_LIFETIME_SECONDS = 5 * 365 * 24 * 60 * 60

// `lastUsedAt` is only informational, so it is batched instead of rewriting the whole store on
// every authenticated request.
const USAGE_FLUSH_INTERVAL_MS = 30_000

export interface StoredApiToken {
  id: string
  hash: string
  prefix: string
  accountId: string
  scopes: TokenScope[]
  name: string
  createdAt: string
  expiresAt?: string
  lastUsedAt?: string
}

interface TokenStoreFormat {
  tokens: StoredApiToken[]
}

@Service()
export class ApiTokenStore {
  private readonly filename = dataDir + '/api-tokens.json'
  private store: TokenStoreFormat
  private pendingWrite: Promise<void> = Promise.resolve()
  private usageFlushTimer?: ReturnType<typeof setTimeout>
  private hasUnsavedUsage = false

  constructor() {
    try {
      const buffer = readFileSync(this.filename)
      this.store = parseTokenStore(buffer.toString())
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error
      }
      this.store = { tokens: [] }
    }
  }

  createToken(
    accountId: string,
    name: string,
    scopes?: TokenScope[],
    expiresInSeconds?: number,
  ): { token: string; info: ApiTokenInfo } {
    const rawToken = randomBytes(32).toString('hex')
    const prefix = `jm_sk_${rawToken.slice(0, 8)}`
    const fullToken = `jm_sk_${rawToken}`
    const hash = createHash('sha256').update(fullToken).digest('hex')

    let expiresAt: string | undefined
    if (expiresInSeconds !== undefined) {
      expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
    }

    const stored: StoredApiToken = {
      id: randomBytes(16).toString('hex'),
      hash,
      prefix,
      accountId,
      scopes: scopes ?? [],
      name,
      createdAt: new Date().toISOString(),
      expiresAt,
    }

    this.store.tokens.push(stored)

    const info: ApiTokenInfo = {
      id: stored.id,
      prefix: stored.prefix,
      scopes: stored.scopes,
      name: stored.name,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
    }

    return { token: fullToken, info }
  }

  validateToken(token: string): { accountId: string; scopes: TokenScope[] } | null {
    const hash = createHash('sha256').update(token).digest('hex')
    const stored = this.store.tokens.find((t) => t.hash === hash)
    if (!stored) return null

    if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
      return null
    }

    stored.lastUsedAt = new Date().toISOString()

    return { accountId: stored.accountId, scopes: stored.scopes }
  }

  listTokens(accountId: string): ApiTokenInfo[] {
    return this.store.tokens
      .filter((t) => t.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ hash: _hash, accountId: _accountId, ...info }) => info)
  }

  revokeToken(tokenId: string, accountId: string): boolean {
    const idx = this.store.tokens.findIndex((t) => t.id === tokenId && t.accountId === accountId)
    if (idx === -1) return false
    this.store.tokens.splice(idx, 1)
    return true
  }

  revokeAllTokens(accountId: string): boolean {
    const originalLength = this.store.tokens.length
    this.store.tokens = this.store.tokens.filter((token) => token.accountId !== accountId)
    return this.store.tokens.length !== originalLength
  }

  async save(): Promise<void> {
    this.hasUnsavedUsage = false
    // Requests can overlap, and an interleaved write would leave a truncated file that stops the
    // server from parsing any token on the next start, so writes are queued and swapped in atomically.
    const write = this.pendingWrite.then(
      () => this.writeStore(),
      () => this.writeStore(),
    )
    this.pendingWrite = write.catch(() => {})
    return write
  }

  /** Notes that a token was used, without paying for a full store rewrite on the request path. */
  recordUsage(): void {
    this.hasUnsavedUsage = true
    if (this.usageFlushTimer !== undefined) {
      return
    }

    this.usageFlushTimer = setTimeout(() => {
      this.usageFlushTimer = undefined
      void this.flushUsage().catch((error) => console.error('Unable to persist API token usage', error))
    }, USAGE_FLUSH_INTERVAL_MS)
    this.usageFlushTimer.unref?.()
  }

  async flushUsage(): Promise<void> {
    if (this.usageFlushTimer !== undefined) {
      clearTimeout(this.usageFlushTimer)
      this.usageFlushTimer = undefined
    }
    if (!this.hasUnsavedUsage) {
      return
    }
    await this.save()
  }

  private async writeStore(): Promise<void> {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    const temporaryFilename = `${this.filename}.${randomBytes(8).toString('hex')}.tmp`
    try {
      await writeFile(temporaryFilename, JSON.stringify(this.store, null, 2) + '\n', { mode: 0o600 })
      await rename(temporaryFilename, this.filename)
    } catch (error) {
      await unlink(temporaryFilename).catch(() => {})
      throw error
    }
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function parseTokenStore(value: string): TokenStoreFormat {
  const parsed: unknown = JSON.parse(value)
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('tokens' in parsed) ||
    !Array.isArray((parsed as TokenStoreFormat).tokens)
  ) {
    throw new Error('Invalid API token store format')
  }
  return parsed as TokenStoreFormat
}
