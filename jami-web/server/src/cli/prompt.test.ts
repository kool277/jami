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
import { afterEach, describe, it, mock } from 'node:test'

const createInterface = mock.fn()

mock.module('node:readline', {
  namedExports: {
    createInterface,
  },
})

describe('promptPassword', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('does not write typed password text to stdout', async () => {
    const { promptPassword } = await import(`./prompt.ts?case=${Date.now()}-${Math.random()}`)
    let answer: ((value: string) => void) | undefined
    let output: { write(chunk: string): boolean } | undefined
    const stdoutWrite = mock.method(process.stdout, 'write', (() => true) as typeof process.stdout.write)
    createInterface.mock.mockImplementation((options) => {
      output = options.output as typeof output
      return {
        question: (_question: string, callback: (value: string) => void) => {
          answer = callback
        },
        close: mock.fn(),
      } as never
    })

    const passwordPromise = promptPassword('Password: ')
    if (!output || !answer) {
      throw new Error('Expected password prompt to create a readline interface')
    }
    const writesAfterQuestion = stdoutWrite.mock.callCount()
    output.write('hidden-password')
    answer('hidden-password')

    assert.equal(await passwordPromise, 'hidden-password')
    assert.equal(stdoutWrite.mock.callCount(), writesAfterQuestion)
  })
})
