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
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, mock } from 'node:test'

import sharp from 'sharp'

import {
  AVATAR_MAX_DIMENSION,
  cacheAvatar,
  cacheProfile,
  decodeVCard,
  detectImageExtension,
  getAvatarBase64,
  getDisplayName,
  getVCardPath,
} from './vCard.js'

describe('getAvatarBase64', () => {
  it('removes PNG and JPEG vCard data URI prefixes', () => {
    for (const avatar of ['data:image/png;base64,iVBORw0KGgo=', 'data:image/jpeg;base64,/9j/4AAQSkY=']) {
      assert.doesNotMatch(getAvatarBase64(avatar), /^data:/)
    }
  })
})

describe('detectImageExtension', () => {
  it('detects the real format so the avatar is served with a matching content type', () => {
    assert.equal(detectImageExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpeg')
    assert.equal(detectImageExtension(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'png')
    assert.equal(detectImageExtension(Buffer.from('GIF89a')), 'gif')
    assert.equal(detectImageExtension(Buffer.from('not an image')), undefined)
  })
})

describe('getVCardPath', () => {
  it('uses the authoritative profile for the current account', () => {
    assert.match(getVCardPath('account-id', 'contact-id', true), /\/account-id\/profile\.vcf$/)
  })

  it('uses cached vCards for contacts', () => {
    assert.match(getVCardPath('account-id', 'contact-id'), /\/account-id\/profiles\/Y29udGFjdC1pZA==\.vcf$/)
  })
})

describe('decodeVCard', () => {
  it('unfolds multiline profile photos', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'jami-web-vcard-'))
    const path = join(directory, 'profile.vcf')
    await writeFile(
      path,
      ['BEGIN:VCARD', 'VERSION:2.1', 'FN:Alice', 'PHOTO;ENCODING=BASE64;TYPE=PNG:iVBORw0K', ' Ggo=', 'END:VCARD'].join(
        '\r\n',
      ),
    )

    try {
      const profile = await decodeVCard(path)
      assert.equal(profile?.photo, 'iVBORw0KGgo=')
    } finally {
      await rm(directory, { recursive: true })
    }
  })
})

describe('cacheAvatar', () => {
  it('replaces stale formats with a bounded WebP thumbnail', async () => {
    const home = await mkdtemp(join(tmpdir(), 'jami-web-avatar-cache-'))
    const accountId = 'account-id'
    const contactUri = 'contact-id'
    const profileFolder = join(home, '.local/share/jami', accountId, 'cache/profile')
    const imageName = btoa(contactUri)
    const homedir = mock.method(os, 'homedir', () => home)
    const source = await sharp({
      create: {
        width: AVATAR_MAX_DIMENSION * 2,
        height: AVATAR_MAX_DIMENSION,
        channels: 3,
        background: '#da1f26',
      },
    })
      .jpeg()
      .toBuffer()

    try {
      await mkdir(profileFolder, { recursive: true })
      await writeFile(join(profileFolder, `${imageName}.png`), Buffer.from('stale'))
      await cacheAvatar(accountId, contactUri, source.toString('base64'))

      const thumbnail = await readFile(join(profileFolder, `${imageName}.webp`))
      const metadata = await sharp(thumbnail).metadata()
      assert.equal(metadata.format, 'webp')
      assert.equal(metadata.width, AVATAR_MAX_DIMENSION)
      assert.ok((metadata.height ?? 0) <= AVATAR_MAX_DIMENSION)
      await assert.rejects(readFile(join(profileFolder, `${imageName}.png`)), { code: 'ENOENT' })
    } finally {
      homedir.mock.restore()
      await rm(home, { recursive: true })
    }
  })
})

describe('cacheProfile', () => {
  it('stores a received vCard name without rereading the local profile path', async () => {
    const home = await mkdtemp(join(tmpdir(), 'jami-web-profile-cache-'))
    const accountId = 'account-id'
    const contactUri = 'contact-id'
    const homedir = mock.method(os, 'homedir', () => home)

    try {
      await cacheProfile(accountId, contactUri, { name: 'Updated Ada' })

      assert.equal(await getDisplayName(accountId, contactUri), 'Updated Ada')
    } finally {
      homedir.mock.restore()
      await rm(home, { recursive: true })
    }
  })
})
