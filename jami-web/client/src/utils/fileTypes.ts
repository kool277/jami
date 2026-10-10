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

export type FileType = 'image' | 'video' | 'audio' | 'other'

const audioExtensions = new Set(['ogg', 'wav', 'mpeg', 'aac', 'flac', 'mp3'])
const imageExtensions = new Set(['apng', 'avif', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'])
const videoExtensions = new Set([
  'mp4',
  'webm',
  'mkv',
  'avi',
  'mov',
  'flv',
  'wmv',
  'm4v',
  '3gp',
  '3gpp',
  '3g2',
  '3gpp2',
])

export const getFileType = (fileName?: string): FileType => {
  const extension = fileName?.split('.').pop()?.toLowerCase()
  if (!extension) {
    return 'other'
  }
  if (imageExtensions.has(extension)) {
    return 'image'
  }
  if (videoExtensions.has(extension)) {
    return 'video'
  }
  if (audioExtensions.has(extension)) {
    return 'audio'
  }
  return 'other'
}
