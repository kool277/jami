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

import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { IOpenIdProviders } from '@savoirfairelinux/jami-web-common'
import { Container, Service } from 'typedi'

import { AdminAccount } from './admin-account.js'

const adminConfig = Container.get(AdminAccount)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '../..')

@Service()
export class OpenIdProviders {
  private readonly filename = path.join(packageRoot, 'openid-providers.json')
  private providers: Map<string, IOpenIdProviders>
  private readonly defaultScope = 'openid%20email%20profile'

  constructor() {
    let buffer: Buffer

    try {
      buffer = readFileSync(this.filename)
      this.providers = new Map(Object.entries(JSON.parse(buffer.toString())))
      if (this.providers === undefined) {
        throw new Error('openid-providers.json is empty')
      }
    } catch (e) {
      buffer = Buffer.from('{}')
      this.providers = new Map(Object.entries(JSON.parse(buffer.toString())))
      this.save()
    }
  }

  getProviders() {
    return this.providers
  }

  getOpenIdProvidersNames() {
    return Array.from(this.providers.keys())
  }

  getOpenIdConfig(provider: string) {
    return this.providers.get(provider)
  }

  setOpenIdProvider(provider: string, config: IOpenIdProviders) {
    this.providers.set(provider, config)
  }

  getRedirectUri(provider: string) {
    const config = this.providers.get(provider)
    if (!config) {
      return undefined
    }
    const uri = `/api/auth/oauth/${provider}/callback`
    return uri
  }

  getDisplayName(provider: string) {
    const config = this.providers.get(provider)
    if (!config) {
      return undefined
    }
    return config.displayName
  }

  getColorTheme(provider: string) {
    const config = this.providers.get(provider)
    if (!config) {
      return undefined
    }
    return config.colorTheme
  }

  getIcon(provider: string) {
    const config = this.providers.get(provider)
    if (!config) {
      return undefined
    }
    return config.icon
  }

  getAllAuthorizeUrls() {
    const urls = new Map<string, string>()

    for (const [provider, config] of this.providers) {
      const admin = adminConfig.getOpenIdProvider(provider)
      const clientId = admin?.clientId
      const isActive = admin?.isActive
      if (!isActive) {
        continue
      }
      if (!clientId) {
        continue
      }

      const scope = config.scope ? config.scope : this.defaultScope

      const url = config.authUri + '?client_id=' + clientId + '&response_type=code' + '&scope=' + scope

      urls.set(provider, url)
    }
    return urls
  }

  async save(): Promise<void> {
    await writeFile(this.filename, JSON.stringify(Object.fromEntries(this.providers), null, 2) + '\n')
  }
}
