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
import fs from 'node:fs'
import path from 'node:path'

function isSafePathSegment(value: string): boolean {
  return (
    value !== '' &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  )
}

function isContainedPath(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath)
  return (
    relativePath !== '' &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  )
}

export function resolveConversationDataFilePath(
  conversationDataDirectory: string,
  conversationId: string,
  fileId: string,
): string | undefined {
  if (!isSafePathSegment(conversationId) || !isSafePathSegment(fileId)) {
    return undefined
  }

  const conversationPath = path.resolve(conversationDataDirectory, conversationId)
  const filePath = path.resolve(conversationPath, fileId)

  // Reject unsafe conversation and file IDs first, then ensure resolved paths stay within their directories.
  if (
    !isContainedPath(path.resolve(conversationDataDirectory), conversationPath) ||
    !isContainedPath(conversationPath, filePath)
  ) {
    return undefined
  }

  // An existing path may contain a symlink that lexically appears inside conversation_data but targets a file outside it.
  if (fs.lstatSync(filePath, { throwIfNoEntry: false })) {
    const realConversationDataDirectory = fs.realpathSync(conversationDataDirectory)
    const realFilePath = fs.realpathSync(filePath)
    if (!isContainedPath(realConversationDataDirectory, realFilePath)) {
      return undefined
    }
  }

  return filePath
}
