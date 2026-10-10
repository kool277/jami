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

import {
  AdminWizardState,
  defaultAutoDownloadLimit,
  defaultConferenceResolution,
  IAdminAccount,
  IAdminConfigState,
} from '@savoirfairelinux/jami-web-common'
import { Service } from 'typedi'

import { dataDir } from '../utils/env.js'

const uploadPath = dataDir + '/uploads/'

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

if (!existsSync(uploadPath)) {
  mkdirSync(uploadPath, { recursive: true })
}

@Service()
export class AdminAccount {
  private readonly filename = dataDir + '/admin.json'
  private adminAccount: IAdminAccount
  private defaultUploadPath: string = uploadPath

  private defaultConfig(): IAdminConfigState {
    return {
      localAuthEnabled: true,
      jamsAuthEnabled: !!this.getJamsServerUrl(),
      guestAccessEnabled: false,
      openIdAuthEnabled: false,
      noLocalMediaEnabled: true,
      conferenceResolution: defaultConferenceResolution,
      uploadPath: this.defaultUploadPath,
    }
  }

  private ensureConfigDefaults(): boolean {
    const defaultConfig = this.defaultConfig()
    let changed = false

    if (this.adminAccount.config === undefined) {
      this.adminAccount.config = defaultConfig
      return true
    }

    for (const key of Object.keys(defaultConfig)) {
      const configKey = key as keyof IAdminConfigState
      if (this.adminAccount.config[configKey] === undefined) {
        changed = true
      }
    }

    if (changed) {
      this.adminAccount.config = {
        ...defaultConfig,
        ...this.adminAccount.config,
      }
    }

    return changed
  }

  constructor() {
    let buffer: Buffer

    //1. when admin.json exists, assign what is in it to the adminAccount variable
    //2. when admin.json exists but there is no config (or anything that is required before accessing the admin panel), initialize it with the default settings and save everything to the admin.json
    //3. when admin.json does not exist, an empty object buffer is created and assgined to the adminAccount, and initialize it with the default configs.
    try {
      buffer = readFileSync(this.filename)
      this.adminAccount = JSON.parse(buffer.toString())
      if (this.ensureConfigDefaults()) {
        this.save()
      }
    } catch (e) {
      buffer = Buffer.from('{}')
      this.adminAccount = JSON.parse(buffer.toString())
      this.init()
      this.save()
    }
  }

  init() {
    this.adminAccount.config = this.defaultConfig()
    this.adminAccount.lastWizardState = AdminWizardState.account
    this.adminAccount.autoDownloadLimit = defaultAutoDownloadLimit
    if (!this.adminAccount.openIdProviders) {
      this.adminAccount.openIdProviders = {}
    }
  }

  getOpenIdProvidersNames() {
    return Object.keys(this.adminAccount.openIdProviders)
  }

  getOpenIdProviders() {
    if (!('openIdProviders' in this.adminAccount) || this.adminAccount.openIdProviders === undefined) {
      this.adminAccount.openIdProviders = {}
      this.save()
    }
    return this.adminAccount.openIdProviders
  }

  getOpenIdProvider(provider: string) {
    return this.adminAccount.openIdProviders[provider]
  }

  isProviderActive(provider: string) {
    const openIdProvider = this.getOpenIdProvider(provider)
    const isActive = openIdProvider?.isActive
    return isActive || false
  }

  setOpenIdProvider(provider: string, clientId: string, clientSecret: string, isActive: boolean) {
    if (!this.getOpenIdProviders()) {
      console.error('openIdProviders is not defined')
      this.adminAccount.openIdProviders = {}
    }
    this.adminAccount.openIdProviders[provider] = {
      isActive,
      clientId,
      clientSecret,
    }
  }

  setOpenIdProviderClientId(provider: string, clientId: string) {
    const openIdProvider = this.getOpenIdProvider(provider)
    if (openIdProvider) {
      openIdProvider.clientId = clientId
    }
  }

  setOpenIdProviderClientSecret(provider: string, clientSecret: string) {
    const openIdProvider = this.getOpenIdProvider(provider)
    if (openIdProvider) {
      openIdProvider.clientSecret = clientSecret
    }
  }

  disableOpenIdProvider(provider: string) {
    const openIdProvider = this.getOpenIdProvider(provider)
    if (openIdProvider) {
      openIdProvider.isActive = false
    }
  }

  enableOpenIdProvider(provider: string) {
    const openIdProvider = this.getOpenIdProvider(provider)
    if (openIdProvider) {
      openIdProvider.isActive = true
    }
  }

  getNumberOfEnabledProviders() {
    return Object.values(this.getOpenIdProviders()).filter((provider) => provider.isActive).length
  }

  getLastWizardState(): AdminWizardState {
    return this.adminAccount.lastWizardState
  }

  setLastWizardState(state: AdminWizardState): void {
    this.adminAccount.lastWizardState = state
    this.save()
  }

  setAutoDownloadLimit(limit: number) {
    if (!('autoDownloadLimit' in this.adminAccount)) {
      this.adminAccount.autoDownloadLimit = defaultAutoDownloadLimit
    }
    if (limit < 0) {
      return
    }
    this.adminAccount.autoDownloadLimit = limit
  }

  getAutoDownloadLimit() {
    if (!('autoDownloadLimit' in this.adminAccount)) {
      this.adminAccount.autoDownloadLimit = defaultAutoDownloadLimit
    }
    return this.adminAccount.autoDownloadLimit
  }

  getUploadPath(): string {
    if (this.ensureConfigDefaults()) {
      this.save()
    }
    return this.adminAccount.config.uploadPath
  }

  getPasswordHash(): string | undefined {
    return this.adminAccount.admin
  }

  setPasswordHash(hashedPassword: string): void {
    this.adminAccount.admin = hashedPassword
  }

  getConfig(): IAdminConfigState {
    if (this.ensureConfigDefaults()) {
      this.save()
    }
    return this.adminAccount.config
  }

  updateConfig(config: Partial<IAdminConfigState>) {
    this.adminAccount.config = {
      ...this.adminAccount.config,
      ...config,
    }
  }

  getNameServerAddress() {
    const name = this.adminAccount.nameserver
    if (typeof name === 'string') {
      return name
    }
    // returns a default value if the name is not set
    return ''
  }

  resetNameServerAdress() {
    //here the goal is to remove completely the name server
    //address and the key from the configuration file
    delete this.adminAccount.nameserver
  }

  setNameServerAdress(value: string) {
    this.adminAccount.nameserver = value
  }

  getJamsServerUrl() {
    const url = this.adminAccount.jamsUrl
    return url
  }

  setJamsServerUrl(value: string): void {
    this.adminAccount.jamsUrl = value
  }

  resetJamsServerUrl(): void {
    delete this.adminAccount.jamsUrl
  }

  async save(): Promise<void> {
    await writeFile(this.filename, JSON.stringify(this.adminAccount, null, 2) + '\n')
  }
}
