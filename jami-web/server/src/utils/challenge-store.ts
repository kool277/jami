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

/**
 * Time-limited in-memory challenge store for WebAuthn ceremonies.
 * Challenges expire after a configurable TTL (default 5 minutes).
 */
export class ChallengeStore {
  private challenges = new Map<string, { challenge: string; expiresAt: number }>()
  private readonly ttlMs: number
  private cleanupTimer: ReturnType<typeof setInterval> | undefined

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs
    // Periodically purge expired entries to prevent memory leaks
    this.cleanupTimer = setInterval(() => this.cleanup(), ttlMs)
    this.cleanupTimer.unref() // Don't prevent Node.js from exiting
  }

  set(key: string, challenge: string): void {
    this.challenges.set(key, { challenge, expiresAt: Date.now() + this.ttlMs })
  }

  consume(key: string): string | undefined {
    const entry = this.challenges.get(key)
    this.challenges.delete(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) return undefined
    return entry.challenge
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.challenges) {
      if (now > entry.expiresAt) this.challenges.delete(key)
    }
  }
}
