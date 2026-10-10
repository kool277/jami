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

interface ListedAccount {
  accountId: string
  hash: string
  displayName: string
  registeredName: string
  botOwner?: string
}

type ExitError = Error & { code?: number; isProcessExit?: boolean }

function makeExitError(code: number): ExitError {
  const error = new Error(`process.exit(${code})`) as ExitError
  error.code = code
  error.isProcessExit = true
  return error
}

function expectExitCode(error: unknown, expectedCode: number): true {
  const exitError = error as ExitError
  assert.equal(exitError.isProcessExit, true)
  assert.equal(exitError.code, expectedCode)
  return true
}

function trapProcessExit() {
  return mock.method(process, 'exit', ((code?: number) => {
    throw makeExitError(code ?? 0)
  }) as (code?: number) => never)
}

interface SetupOptions {
  listedAccounts?: ListedAccount[]
  createResult?: {
    displayName: string
    accountId: string
    accountHash: string
  }
  promptAnswers?: string[]
  promptPasswordAnswers?: string[]
  chooseIndex?: number
}

async function setupAccountModule(options: SetupOptions = {}) {
  const {
    listedAccounts = [],
    createResult = {
      displayName: 'Test User',
      accountId: 'account-1',
      accountHash: 'hash-account-1',
    },
    promptAnswers = [],
    promptPasswordAnswers = [],
    chooseIndex = 0,
  } = options

  const callLog = {
    loadEnvCalls: 0,
    closePromptCalls: 0,
    promptQuestions: [] as string[],
    promptPasswordQuestions: [] as string[],
    chooseCalls: [] as { question: string; choices: string[] }[],
    createRequests: [] as { displayName: string; password: string }[],
    listCalls: 0,
    removeRequests: [] as string[],
  }

  mock.module('./control/client.js', {
    namedExports: {
      createCliAccountRequest: async (payload: { displayName: string; password: string }) => {
        callLog.createRequests.push(payload)
        return createResult
      },
      listCliAccountsRequest: async () => {
        callLog.listCalls += 1
        return listedAccounts
      },
      removeCliAccountRequest: async (accountId: string) => {
        callLog.removeRequests.push(accountId)
      },
    },
  })

  mock.module('../utils/env.js', {
    namedExports: {
      loadEnv: () => {
        callLog.loadEnvCalls += 1
      },
    },
  })

  mock.module('./prompt.js', {
    namedExports: {
      choose: async (question: string, choices: string[]) => {
        callLog.chooseCalls.push({ question, choices })
        return chooseIndex
      },
      closePrompt: () => {
        callLog.closePromptCalls += 1
      },
      prompt: async (question: string) => {
        callLog.promptQuestions.push(question)
        return promptAnswers.shift() ?? ''
      },
      promptPassword: async (question: string) => {
        callLog.promptPasswordQuestions.push(question)
        return promptPasswordAnswers.shift() ?? ''
      },
    },
  })

  const logs: string[] = []
  const errors: string[] = []
  mock.method(console, 'log', (...args: unknown[]) => {
    logs.push(args.map(String).join(' '))
  })
  mock.method(console, 'error', (...args: unknown[]) => {
    errors.push(args.map(String).join(' '))
  })

  const exitTrap = trapProcessExit()
  const accountModule = await import(`./account.ts?case=${Date.now()}-${Math.random()}`)

  return {
    accountModule,
    callLog,
    logs,
    errors,
    exitTrap,
  }
}

describe('account CLI', () => {
  afterEach(() => {
    mock.restoreAll()
  })

  it('creates an account from space-separated arguments', async () => {
    const { accountModule, callLog, logs } = await setupAccountModule({
      createResult: {
        displayName: 'Space User',
        accountId: 'account-1',
        accountHash: 'hash-account-1',
      },
    })

    await assert.rejects(
      () => accountModule.accountsCommand(['create', '--displayName', 'Space User', '--password', 'space-password']),
      (error) => expectExitCode(error, 0),
    )

    assert.deepEqual(callLog.createRequests, [
      {
        displayName: 'Space User',
        password: 'space-password',
      },
    ])
    assert.equal(callLog.loadEnvCalls, 1)
    assert.equal(callLog.closePromptCalls, 1)
    assert.equal(
      logs.some((line) => line.includes('Jami account created')),
      true,
    )
    assert.equal(
      logs.some((line) => line.includes('Account hash: hash-account-1')),
      true,
    )
  })

  it('lists available accounts and bot owner information', async () => {
    const { accountModule, callLog, logs, errors } = await setupAccountModule({
      listedAccounts: [
        {
          accountId: 'bot-account-id',
          hash: 'bot-hash',
          displayName: 'Bot Account',
          registeredName: 'bot_name',
          botOwner: 'owner-hash',
        },
        {
          accountId: 'user-account-id',
          hash: 'user-hash',
          displayName: 'User Account',
          registeredName: '',
        },
      ],
    })

    await assert.rejects(
      () => accountModule.accountsCommand(['list']),
      (error) => expectExitCode(error, 0),
    )

    assert.equal(callLog.listCalls, 1)
    assert.equal(callLog.loadEnvCalls, 1)
    assert.equal(callLog.closePromptCalls, 1)
    assert.equal(errors.length, 0)
    assert.equal(
      logs.some((line) => line.includes('Jami accounts (2)')),
      true,
    )
    assert.equal(
      logs.some((line) => line.includes('Hash:            bot-hash')),
      true,
    )
    assert.equal(
      logs.some((line) => line.includes('Bot owner:       owner-hash')),
      true,
    )
  })

  it('removes an account from --accountId argument', async () => {
    const { accountModule, callLog, logs } = await setupAccountModule({
      listedAccounts: [
        {
          accountId: 'first-account-id',
          hash: 'first-hash',
          displayName: 'First Account',
          registeredName: 'first_registered',
        },
        {
          accountId: 'second-account-id',
          hash: 'second-hash',
          displayName: 'Second Account',
          registeredName: 'second_registered',
        },
      ],
    })

    await assert.rejects(
      () => accountModule.accountsCommand(['remove', '--accountId', 'second-account-id']),
      (error) => expectExitCode(error, 0),
    )

    assert.deepEqual(callLog.removeRequests, ['second-account-id'])
    assert.equal(callLog.loadEnvCalls, 1)
    assert.equal(callLog.closePromptCalls, 1)
    assert.equal(
      logs.some((line) => line.includes('Jami account removed: second-account-id')),
      true,
    )
  })

  it('prompts in TTY mode when --accountId is omitted for remove', async () => {
    const { accountModule, callLog } = await setupAccountModule({
      listedAccounts: [
        {
          accountId: 'first-account-id',
          hash: 'first-hash',
          displayName: 'First Account',
          registeredName: 'first_registered',
        },
        {
          accountId: 'second-account-id',
          hash: 'second-hash',
          displayName: 'Second Account',
          registeredName: 'second_registered',
        },
      ],
      chooseIndex: 1,
    })

    const stdin = process.stdin as unknown as { isTTY: boolean }
    const previousIsTTY = stdin.isTTY
    stdin.isTTY = true

    try {
      await assert.rejects(
        () => accountModule.accountsCommand(['remove']),
        (error) => expectExitCode(error, 0),
      )
    } finally {
      stdin.isTTY = previousIsTTY
    }

    assert.deepEqual(callLog.removeRequests, ['second-account-id'])
    assert.equal(callLog.chooseCalls.length, 1)
    assert.equal(callLog.chooseCalls[0].question, 'Which account should be removed?')
    assert.equal(callLog.loadEnvCalls, 1)
    assert.equal(callLog.closePromptCalls, 1)
  })
})
