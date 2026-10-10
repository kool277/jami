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

export class LoginGuard {
  attempts: Map<string, { attempts: number; lastAttemptTime: number }>
  maxLoginAttempts = 5
  timeWindow = 60 * 25 * 1000 // 25 minutes in milliseconds

  constructor() {
    this.attempts = new Map<string, { attempts: number; lastAttemptTime: number }>()
  }

  setFailedLogin(account: string) {
    if (this.isBlocked(account)) {
      return
    }
    if (this.attempts.has(account)) {
      this.attempts.get(account)!.attempts += 1
      this.attempts.get(account)!.lastAttemptTime = Date.now()
    } else {
      this.attempts.set(account, { attempts: 1, lastAttemptTime: Date.now() })
    }
  }

  isBlocked(account: string): boolean {
    if (!this.attempts.has(account)) {
      return false
    }
    const timeLeft = this.timeWindow - (Date.now() - this.attempts.get(account)!.lastAttemptTime)
    if (timeLeft < 0) {
      this.attempts.delete(account)
      return false
    }

    if (this.attempts.get(account)!.attempts < this.maxLoginAttempts) {
      return false
    }

    return true
  }

  resetAttempts(account: string) {
    this.attempts.delete(account)
  }
}
