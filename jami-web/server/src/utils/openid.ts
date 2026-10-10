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
import { AccountDetails } from '@savoirfairelinux/jami-web-common'
import axios from 'axios'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { RegistrationState } from '../jamid/state-enums.js'
import { Accounts } from '../storage/accounts.js'
import { AdminAccount } from '../storage/admin-account.js'
import { OpenIdProviders } from '../storage/openid-providers.js'
import { signJwt } from './jwt.js'

const jamid = Container.get(Jamid)
const accounts = Container.get(Accounts)
const config = Container.get(AdminAccount)
const providers = Container.get(OpenIdProviders)

export async function exchangeCodeForToken(code: string, provider: string, baseUrl: string) {
  const providerInfo = config.getOpenIdProvider(provider)

  if (providerInfo === undefined) {
    return
  }

  const endpoints = providers.getOpenIdConfig(provider)
  if (endpoints === undefined) {
    return
  }

  const redirectUri = providers.getRedirectUri(provider)
  if (redirectUri === undefined) {
    return
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  const response = await axios.post(
    endpoints.tokenUri,
    {
      code,
      // eslint-disable-next-line camelcase
      client_id: providerInfo.clientId,
      // eslint-disable-next-line camelcase
      client_secret: providerInfo.clientSecret,
      // eslint-disable-next-line camelcase
      redirect_uri: baseUrl + redirectUri,
      // eslint-disable-next-line camelcase
      grant_type: 'authorization_code',
    },
    {
      headers,
    },
  )
  return response.data
}

export async function exchangeTokenForUserInfo(accessToken: string, provider: string) {
  const providerInfo = config.getOpenIdProvider(provider)
  if (providerInfo === undefined) {
    return
  }

  const endpoints = providers.getOpenIdConfig(provider)
  if (endpoints === undefined) {
    return
  }

  const userInfoUri = endpoints.infoUri
  const response = await axios.get(userInfoUri, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  return response.data
}

export async function getJwt(email: string, userName: string, service: string) {
  const accountData = accounts.getOpenIdAccount(email)
  if (accountData === undefined) {
    const accountDetails: Partial<AccountDetails> = {
      'Account.displayName': userName,
    }

    const { accountId: accId, state } = await jamid.addAccount(accountDetails)
    if (state === RegistrationState.ErrorGeneric) {
      jamid.removeAccount(accId)
      return 'INVALID'
    }

    accounts.set(email, [service], 'openid', accId)
    await accounts.save()

    const jwt = await signJwt(accId)
    return jwt
  }

  const accountId = accountData.accountId
  if (accountId && accountId !== '') {
    if (!accountData.service.includes(service)) {
      accountData.service.push(service)
      accounts.set(email, accountData.service, 'openid', accountId)
      accounts.save()
    }
    const jwt = await signJwt(accountId)
    return jwt
  }
  return 'INVALID'
}

export async function getBase64Picture(url: string) {
  const response = await axios.get(url, { responseType: 'arraybuffer' })
  const buffer = Buffer.from(response.data, 'binary')
  return buffer.toString('base64')
}
