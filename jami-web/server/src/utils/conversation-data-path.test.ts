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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { resolveConversationDataFilePath } from './conversation-data-path.js'

const conversationDataDirectory = '/var/lib/jami/account/conversation_data'

describe('resolveConversationDataFilePath', () => {
  it('resolves a file within its conversation directory', () => {
    assert.equal(
      resolveConversationDataFilePath(conversationDataDirectory, 'conversation-id', 'file-id.png'),
      path.join(conversationDataDirectory, 'conversation-id', 'file-id.png'),
    )
  })

  it('rejects a file symlink that points outside conversation data', () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'jami-conversation-data-path-'))
    const conversationDataDirectory = path.join(temporaryDirectory, 'conversation_data')
    const conversationDirectory = path.join(conversationDataDirectory, 'conversation-id')
    const outsideFile = path.join(temporaryDirectory, 'outside-file')

    try {
      fs.mkdirSync(conversationDirectory, { recursive: true })
      fs.writeFileSync(outsideFile, 'outside')
      fs.symlinkSync(outsideFile, path.join(conversationDirectory, 'file-id'))

      assert.equal(resolveConversationDataFilePath(conversationDataDirectory, 'conversation-id', 'file-id'), undefined)
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true })
    }
  })

  for (const [conversationId, fileId] of [
    ['..', 'file-id'],
    ['../secret', 'file-id'],
    ['conversation-id', '..'],
    ['conversation-id', '../secret'],
    ['conversation-id', 'nested/file-id'],
    ['conversation-id', 'nested\\file-id'],
    ['conversation-id', '\0file-id'],
  ]) {
    it(`rejects unsafe path components: ${JSON.stringify([conversationId, fileId])}`, () => {
      assert.equal(resolveConversationDataFilePath(conversationDataDirectory, conversationId, fileId), undefined)
    })
  }
})
