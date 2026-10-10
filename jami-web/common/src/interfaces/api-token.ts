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
export const API_TOKEN_SCOPES = [
  'conversations:read',
  'conversations:write',
  'contacts:read',
  'contacts:write',
  'calls:read',
  'calls:write',
  'files:read',
  'files:write',
  'account:read',
  'account:write',
] as const

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number]

export interface ApiTokenInfo {
  id: string
  prefix: string
  scopes: ApiTokenScope[]
  name: string
  createdAt: string
  expiresAt?: string
  lastUsedAt?: string
}

export interface CreateApiTokenRequest {
  name: string
  scopes: ApiTokenScope[]
  expiresInSeconds?: number
}

export interface CreateApiTokenResponse {
  token: string
  info: ApiTokenInfo
}
