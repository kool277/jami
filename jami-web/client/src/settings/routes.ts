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
export const userSettingsRoutePaths = {
  manageAccount: 'account/manage-account',
  customizeProfile: 'account/customize-profile',
  passkeys: 'account/passkeys',
  calls: 'account/calls',
  linkedDevices: 'account/linked-devices',
  exportDevice: 'account/linked-devices/export',
  appAccess: 'account/app-access',
  general: 'general',
  generalSystem: 'general/system',
  generalAppearance: 'general/appearance',
  generalChat: 'general/chat',
} as const

export type UserSettingsRoutePath = (typeof userSettingsRoutePaths)[keyof typeof userSettingsRoutePaths]

export const userSettingsPath = (path: UserSettingsRoutePath) => `/settings/${path}`
