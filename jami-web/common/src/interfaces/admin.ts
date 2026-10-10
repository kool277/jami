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

import { AdminWizardState } from '../enums/admin-wizard-state.js'

export const conferenceResolutionValues = ['720p', '1080p', '1440p'] as const
export type ConferenceResolution = (typeof conferenceResolutionValues)[number]
export const defaultConferenceResolution: ConferenceResolution = '720p'
export const defaultAutoDownloadLimit = 20

export interface IAdminConfigState {
  localAuthEnabled: boolean
  jamsAuthEnabled: boolean
  guestAccessEnabled: boolean
  openIdAuthEnabled: boolean
  noLocalMediaEnabled: boolean
  conferenceResolution: ConferenceResolution
  uploadPath: string
}

export interface IOpenIdProviderConfiguration {
  isActive: boolean
  clientId: string
  clientSecret: string
}

export interface IOpenIdProviders {
  infoUri: string
  tokenUri: string
  authUri: string
  displayName: string
  documentation: string
  scope?: string
  icon?: string
  colorTheme?: string
}

export interface IAdminAccount {
  admin: string
  config: IAdminConfigState
  lastWizardState: AdminWizardState
  nameserver?: string
  jamsUrl?: string
  openIdProviders: Record<string, IOpenIdProviderConfiguration>
  autoDownloadLimit?: number // size (in Mb) of the file that can be downloaded without user interaction
}

//For runtime type check
export const adminConfigValuePair = {
  localAuthEnabled: 'boolean',
  jamsAuthEnabled: 'boolean',
  guestAccessEnabled: 'boolean',
  openIdAuthEnabled: 'boolean',
  noLocalMediaEnabled: 'boolean',
  conferenceResolution: 'string',
  uploadPath: 'string',
}

export interface AccountOverview {
  username: string
  accountUri: string
  auth: string
  storage: number
  accountId: string
  expirationDate?: number
}

export interface AdminCreateAccountRequest {
  username: string
  password: string
}

export interface AdminResetAccountPasswordRequest {
  password: string
}

export interface AdminAccountActionResult {
  accountId: string
  success: boolean
  error?: string
}
