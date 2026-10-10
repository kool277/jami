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
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDirectory = join(repositoryRoot, 'server/client/dist/assets')

function getInitialStaticChunks() {
  const html = readFileSync(join(repositoryRoot, 'server/client/dist/index.html'), 'utf8')
  const entryMatch = html.match(/<script[^>]+src="\/assets\/([^"/]+\.js)"/)
  assert.ok(entryMatch, 'Production HTML has no JavaScript entry')

  const chunks = new Set()
  const pending = [entryMatch[1]]
  while (pending.length > 0) {
    const filename = pending.pop()
    if (!filename || chunks.has(filename)) continue

    chunks.add(filename)
    const source = readFileSync(join(assetsDirectory, filename), 'utf8')
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)["']\.\/([^"']+\.js)["']/g)) {
      pending.push(match[1])
    }
  }

  return chunks
}

test('initial HTML does not eagerly load route-shared chunks', () => {
  const html = readFileSync(join(repositoryRoot, 'server/client/dist/index.html'), 'utf8')
  const eagerSharedChunks = [...html.matchAll(/<script[^>]+src="[^"]*\/shared[^"/]*\.js"/g)].map((match) => match[0])

  assert.deepEqual(eagerSharedChunks, [])
})

test('production chunks use native top-level await', () => {
  const transformedChunks = new Map(
    readdirSync(assetsDirectory)
      .filter((filename) => filename.endsWith('.js'))
      .map((filename) => {
        const source = readFileSync(join(assetsDirectory, filename), 'utf8')
        return [filename, source]
      })
      .filter(([, source]) => source.includes('let __tla =')),
  )

  assert.deepEqual([...transformedChunks.keys()], [])
})

test('initial module graph does not load the emoji picker', () => {
  const emojiPickerChunks = [...getInitialStaticChunks()].filter((filename) =>
    /^emoji(?:Picker|-picker-react)/.test(filename),
  )

  assert.deepEqual(emojiPickerChunks, [])
})
