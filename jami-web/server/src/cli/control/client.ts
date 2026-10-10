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
import { request } from 'node:http'

import type {
  CliAccountSummary,
  CliCreateAccountResult,
  CliCreateBotResult,
} from '../../services/cli-control-service.js'
import { resolveRuntimeSettings } from '../../utils/runtime.js'

interface CliControlRequestOptions {
  method: 'GET' | 'POST' | 'DELETE'
  headers?: Record<string, string>
  body?: string
}

interface CliControlRawResponse {
  statusCode: number
  body: string
}

function getCliControlSocketPath(): string {
  return resolveRuntimeSettings().cliControlSocketPath
}

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code = 'code' in error ? String(error.code) : ''
  return code === 'ENOENT' || code === 'ECONNREFUSED'
}

async function sendCliControlRequest(path: string, options: CliControlRequestOptions): Promise<CliControlRawResponse> {
  return new Promise((resolvePromise, rejectPromise) => {
    const requestHeaders = options.headers ?? {}

    const req = request(
      {
        socketPath: getCliControlSocketPath(),
        path,
        method: options.method,
        headers: requestHeaders,
      },
      (res) => {
        let responseBody = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          responseBody += chunk
        })
        res.on('end', () => {
          resolvePromise({
            statusCode: res.statusCode ?? 500,
            body: responseBody,
          })
        })
      },
    )

    req.on('error', (error) => {
      rejectPromise(error)
    })

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

async function isServerReady(): Promise<boolean> {
  try {
    const response = await sendCliControlRequest('/cli/health', { method: 'GET' })
    return response.statusCode >= 200 && response.statusCode < 300
  } catch (error) {
    if (isConnectionError(error)) {
      return false
    }

    throw error
  }
}

export async function ensureCliServerReady(): Promise<void> {
  if (await isServerReady()) {
    return
  }

  throw new Error(
    `Jami Web server is not running. Start it first with "jami-web" or "jami-web start" ` +
      `and ensure CLI control API is available on unix socket ${getCliControlSocketPath()}.`,
  )
}

async function requestCliControl<T>(path: string, options: CliControlRequestOptions): Promise<T> {
  await ensureCliServerReady()

  let response: CliControlRawResponse
  try {
    response = await sendCliControlRequest(path, options)
  } catch (error) {
    if (isConnectionError(error)) {
      throw new Error(`Could not connect to Jami Web CLI control API on unix socket ${getCliControlSocketPath()}.`, {
        cause: error,
      })
    }

    throw error
  }

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `CLI control API request failed (${response.statusCode}) on unix socket ${getCliControlSocketPath()} at ${path}` +
        `${response.body ? `: ${response.body}` : ''}`,
    )
  }

  if (response.statusCode === 204) {
    return undefined as T
  }

  if (!response.body) {
    return undefined as T
  }

  return JSON.parse(response.body) as T
}

export async function listCliAccountsRequest(): Promise<CliAccountSummary[]> {
  return requestCliControl<CliAccountSummary[]>('/cli/accounts', {
    method: 'GET',
  })
}

export async function createCliAccountRequest(payload: {
  displayName: string
  password: string
}): Promise<CliCreateAccountResult> {
  return requestCliControl<CliCreateAccountResult>('/cli/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function removeCliAccountRequest(accountId: string): Promise<void> {
  await requestCliControl<{ accountId: string }>(`/cli/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
  })
}

export async function createCliBotRequest(payload: {
  displayName: string
  owner: string
}): Promise<CliCreateBotResult> {
  return requestCliControl<CliCreateBotResult>('/cli/bots', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}
