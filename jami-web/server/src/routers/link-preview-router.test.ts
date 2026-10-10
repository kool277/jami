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
import 'reflect-metadata'

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { after, before, describe, it, mock } from 'node:test'

const require = createRequire(import.meta.url)
const linkPreviewRequire = createRequire(require.resolve('link-preview-js'))
const linkPreviewUndici = linkPreviewRequire.resolve('undici')

let getLinkPreview: typeof import('link-preview-js').getLinkPreview
let linkPreviewOptions: typeof import('./link-preview-router.js').linkPreviewOptions
let resolvePreviewHost: typeof import('./link-preview-router.js').resolvePreviewHost
let lookedUpHostname: string | undefined

before(async () => {
  mock.module('node:dns/promises', {
    namedExports: {
      lookup: async (hostname: string) => {
        lookedUpHostname = hostname
        return { address: '127.0.0.1' }
      },
    },
  })

  mock.module(linkPreviewUndici, {
    namedExports: {
      Agent: class {
        destroy() {}
      },
      fetch: (url: string, options: RequestInit) => globalThis.fetch(url, options),
    },
  })

  ;({ getLinkPreview } = await import('link-preview-js'))
  ;({ linkPreviewOptions, resolvePreviewHost } = await import('./link-preview-router.js'))
})

after(() => mock.restoreAll())

describe('link preview SSRF protection', () => {
  it('resolves the preview hostname before fetching', async () => {
    lookedUpHostname = undefined

    assert.equal(await resolvePreviewHost('http://localhost/path'), '127.0.0.1')
    assert.equal(lookedUpHostname, 'localhost')
  })

  it('blocks non-public DNS resolutions before making a fetch request', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', (async () => {
      throw new Error('fetch must not be called for blocked destinations')
    }) as typeof fetch)

    assert.equal(linkPreviewOptions.resolveDNSHost, resolvePreviewHost)

    for (const address of ['127.0.0.1', '::1', '10.0.0.1', '169.254.169.254']) {
      await assert.rejects(
        getLinkPreview('http://example.com/', {
          ...linkPreviewOptions,
          resolveDNSHost: async () => address,
        }),
        /SSRF request detected/,
      )
    }

    assert.equal(fetchMock.mock.calls.length, 0)
  })

  it('fetches HTTPS URLs while preserving the hostname for TLS', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async (url: string) => {
      assert.equal(url, 'https://example.com/')
      const response = new Response('<html><head><title>Example</title></head></html>', {
        headers: { 'content-type': 'text/html' },
      })
      Object.defineProperty(response, 'url', { value: 'https://example.com/' })
      return response
    })

    const preview = await getLinkPreview('https://example.com/', {
      ...linkPreviewOptions,
      resolveDNSHost: async () => '93.184.216.34',
    })

    assert.equal(preview.url, 'https://example.com/')
    assert.equal(fetchMock.mock.calls.length, 1)
  })
})
