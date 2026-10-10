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
import fs from 'fs/promises'
import os from 'os'
import sharp from 'sharp'
import { parseVCards } from 'vcard4-ts'

export async function decodeVCard(path: string) {
  const data: { name: string; photo?: string } = { name: '', photo: undefined }
  try {
    const file = await fs.readFile(path)
    const card = parseVCards(file.toString().replace(/\r?\n[ \t]/g, ''))
    if (card.vCards) {
      data.name = card.vCards[0].FN[0].value
      if (card.vCards[0].PHOTO) {
        data.photo = card.vCards[0].PHOTO[0].value
      }
    }
    return data
  } catch (e) {
    return undefined
  }
}

export function getVCardPath(accountId: string, contactUri: string, isOwnProfile = false) {
  if (isOwnProfile) {
    return os.homedir() + '/.local/share/jami/' + accountId + '/profile.vcf'
  }
  const fileName = btoa(contactUri) + '.vcf'
  return os.homedir() + '/.local/share/jami/' + accountId + '/profiles/' + fileName
}

export async function getVCard(accountId: string, contactUri: string, isOwnProfile = false) {
  const path = getVCardPath(accountId, contactUri, isOwnProfile)
  return decodeVCard(path)
}

export async function getDisplayName(accountId: string, contactUri: string) {
  const folder = os.homedir() + '/.local/share/jami/' + accountId + '/cache/profile'
  const fileName = btoa(contactUri) + '.txt'
  const path = folder + '/' + fileName
  try {
    const file = await fs.readFile(path)
    return file.toString()
  } catch (e) {
    return undefined
  }
}

export async function getBotOwner(accountId: string): Promise<string | undefined> {
  const profilePath = os.homedir() + '/.local/share/jami/' + accountId + '/profile.vcf'

  try {
    const card = parseVCards(await fs.readFile(profilePath, 'utf-8'))
    const related = card.vCards?.[0]?.RELATED as Array<{ parameters?: { TYPE?: string[] }; value?: string }> | undefined
    const owner = related?.find((item) => item.parameters?.TYPE?.includes('owner'))?.value
    return owner?.replace(/^jami:/, '')
  } catch {
    return undefined
  }
}

export function getAvatarBase64(photo: string) {
  return photo.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '')
}

const avatarExtensions = ['png', 'jpeg', 'gif', 'webp'] as const
export const AVATAR_MAX_DIMENSION = 256
const AVATAR_MAX_SOURCE_BYTES = 25 * 1024 * 1024
const AVATAR_WEBP_QUALITY = 80

async function clearAvatarImages(profileFolder: string, imageName: string) {
  for (const extension of avatarExtensions) {
    await fs.rm(`${profileFolder}/${imageName}.${extension}`, { force: true })
  }
}

// The cached file extension determines the Content-Type express serves it with.
// vCard photos are not necessarily PNG, so sniff the real format from the magic
// bytes: an image served under a mismatched type is rejected by the browser.
export function detectImageExtension(data: Buffer): (typeof avatarExtensions)[number] | undefined {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'jpeg'
  }
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png'
  }
  if (data.subarray(0, 3).toString('latin1') === 'GIF') {
    return 'gif'
  }
  if (data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'webp'
  }
  return undefined
}

export async function cacheAvatar(accountId: string, contactUri: string, photo: string) {
  const profileFolder = os.homedir() + '/.local/share/jami/' + accountId + '/cache/profile'
  const imageName = btoa(contactUri)
  const buffer = Buffer.from(getAvatarBase64(photo), 'base64')
  await fs.mkdir(profileFolder, { recursive: true })
  const extension = detectImageExtension(buffer)
  await clearAvatarImages(profileFolder, imageName)
  if (!extension || buffer.length === 0 || buffer.length > AVATAR_MAX_SOURCE_BYTES) {
    return undefined
  }

  const imagePath = `${profileFolder}/${imageName}.webp`
  try {
    await sharp(buffer, { limitInputPixels: 64 * 1024 * 1024 })
      .rotate()
      .resize(AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: AVATAR_WEBP_QUALITY })
      .toFile(imagePath)
  } catch (error) {
    console.warn('Unable to cache invalid profile image', error)
    return undefined
  }

  return imagePath
}

export async function cacheProfile(accountId: string, contactUri: string, profile: { name: string; photo?: string }) {
  const profileFolder = os.homedir() + '/.local/share/jami/' + accountId + '/cache/profile'
  const imageName = btoa(contactUri)

  await fs.mkdir(profileFolder, { recursive: true })
  if (profile.name) {
    await fs.writeFile(`${profileFolder}/${imageName}.txt`, profile.name)
  }
  if (profile.photo) {
    return cacheAvatar(accountId, contactUri, profile.photo)
  }
  return undefined
}

export async function getAvatar(accountId: string, contactUri: string, isOwnProfile = false) {
  const cacheFolder = os.homedir() + '/.local/share/jami/' + accountId + '/cache'
  const profileFolder = cacheFolder + '/profile'
  const imgName = btoa(contactUri)
  await fs.mkdir(cacheFolder, { recursive: true })
  await fs.mkdir(profileFolder, { recursive: true })
  for (const extension of avatarExtensions) {
    const cachedPath = `${profileFolder}/${imgName}.${extension}`
    try {
      await fs.access(cachedPath)
      if (extension !== 'webp') {
        const cachedAvatar = await fs.readFile(cachedPath)
        return cacheAvatar(accountId, contactUri, cachedAvatar.toString('base64'))
      }
      return cachedPath
    } catch (e) {
      /* not cached under this extension */
    }
  }
  const data = await getVCard(accountId, contactUri, isOwnProfile)
  if (data?.name) {
    await fs.writeFile(profileFolder + '/' + imgName + '.txt', data.name)
  }
  if (data?.photo) {
    return cacheAvatar(accountId, contactUri, data.photo)
  }
  return undefined
}

// Removes the cached avatar (and display name) for a contact so the next
// request regenerates it from the (possibly updated) vCard. Without this,
// getAvatar keeps serving a stale cached image after the profile changes.
export async function clearAvatarCache(accountId: string, contactUri: string) {
  const profileFolder = os.homedir() + '/.local/share/jami/' + accountId + '/cache/profile'
  const imgName = btoa(contactUri)
  await clearAvatarImages(profileFolder, imgName)
  await fs.rm(profileFolder + '/' + imgName + '.txt', { force: true })
}
