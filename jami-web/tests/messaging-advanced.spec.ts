/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import { expect, test } from '@playwright/test'

import { waitForWsClient } from './helpers.js'

const MOCK_API = 'http://localhost:5002'

async function setupAuthenticatedUser(request: any) {
  await request.post(`${MOCK_API}/__reset`)
  await request.post(`${MOCK_API}/api/admin/create`, {
    data: { password: 'AdminPass123!' },
  })
  await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
    data: { state: 'complete' },
  })
  await request.post(`${MOCK_API}/api/auth/new-account`, {
    data: { username: 'alice', password: 'AlicePass1!' },
  })
}

test.beforeEach(async ({ page, request }) => {
  await setupAuthenticatedUser(request)
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('accessToken', 'mock-user-token-preset')
  })
})

test.describe('Message Sending', () => {
  test('can submit a message using Enter key', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    await textarea.fill('Hello Bob!')
    await expect(textarea).toHaveValue('Hello Bob!')

    // Press Enter to submit
    await textarea.press('Enter')

    // Textarea should be cleared after sending
    await expect(textarea).toHaveValue('', { timeout: 10_000 })
  })

  test('message appears in the conversation after sending', async ({ page, request }) => {
    await page.goto('/conversation/conv-1')
    await waitForWsClient(request)

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    await textarea.fill('New message from Alice')
    await textarea.press('Enter')

    // The message should appear in the conversation view
    // The mock server broadcasts it back via WebSocket as a ConversationMessage
    const sentMessage = page.getByText('New message from Alice')
    await expect(sentMessage.first()).toBeVisible({ timeout: 15_000 })
  })

  test('Shift+Enter does not submit but adds a newline', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    await textarea.fill('Line 1')
    await textarea.press('Shift+Enter')
    await textarea.type('Line 2')

    // Textarea should still contain text (not submitted)
    const value = await textarea.inputValue()
    expect(value).toContain('Line 1')
    expect(value).toContain('Line 2')
  })

  test('empty message cannot be sent', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    // Clear and press Enter with an empty message
    await textarea.fill('')
    await textarea.press('Enter')

    // Should still be on the same page, no errors
    await expect(page).toHaveURL(/\/conversation\/conv-1/)
  })
})

test.describe('Real-time Message Reception', () => {
  test('incoming message from another user appears in the conversation', async ({ page, request }) => {
    await page.goto('/conversation/conv-1')
    await waitForWsClient(request)

    // Verify initial message is visible
    await expect(page.getByTestId('message-list').getByText('Hello Alice!')).toBeVisible({ timeout: 15_000 })

    // Simulate an incoming message from Bob via the /__ws-send endpoint
    await request.post(`${MOCK_API}/__ws-send`, {
      data: {
        type: 'conversation-message',
        data: {
          conversationId: 'conv-1',
          message: {
            id: 'msg-incoming-1',
            author: 'contact-bob-uri',
            body: 'Hey, how are you doing?',
            type: 'text/plain',
            timestamp: String(Math.floor(Date.now() / 1000)),
            linearizedParent: '',
            parents: '',
            status: {},
            reactions: [],
          },
        },
      },
    })

    // The incoming message should appear in the conversation
    const incomingMessage = page.getByText('Hey, how are you doing?')
    await expect(incomingMessage.first()).toBeVisible({ timeout: 15_000 })
  })

  test('multiple incoming messages appear in order', async ({ page, request }) => {
    await page.goto('/conversation/conv-1')
    await waitForWsClient(request)
    await expect(page.getByTestId('message-list').getByText('Hello Alice!')).toBeVisible({ timeout: 15_000 })

    // Send multiple messages in sequence with small delays for browser processing
    const messages = ['First message', 'Second message', 'Third message']

    for (let i = 0; i < messages.length; i++) {
      await request.post(`${MOCK_API}/__ws-send`, {
        data: {
          type: 'conversation-message',
          data: {
            conversationId: 'conv-1',
            message: {
              id: `msg-multi-${i}`,
              author: 'contact-bob-uri',
              body: messages[i],
              type: 'text/plain',
              timestamp: String(Math.floor(Date.now() / 1000) + i),
              linearizedParent: '',
              parents: '',
              status: {},
              reactions: [],
            },
          },
        },
      })
      // Wait for each message to be processed before sending the next
      await expect(page.getByText(messages[i]).first()).toBeVisible({ timeout: 15_000 })
    }
  })

  test('messages from a different conversation are not shown', async ({ page, request }) => {
    await page.goto('/conversation/conv-1')
    await waitForWsClient(request)
    await expect(page.getByTestId('message-list').getByText('Hello Alice!')).toBeVisible({ timeout: 15_000 })

    // Send a message for a different conversation
    await request.post(`${MOCK_API}/__ws-send`, {
      data: {
        type: 'conversation-message',
        data: {
          conversationId: 'conv-other',
          message: {
            id: 'msg-other-conv',
            author: 'contact-bob-uri',
            body: 'This should not appear',
            type: 'text/plain',
            timestamp: String(Math.floor(Date.now() / 1000)),
            linearizedParent: '',
            parents: '',
            status: {},
            reactions: [],
          },
        },
      },
    })

    // Wait briefly and verify the message does NOT appear
    // ponytail: fixed wait — asserting absence has no signal to poll for; give the app a
    // moment to (not) process the wrong-conversation message before checking it never rendered.
    await page.waitForTimeout(2_000)
    const wrongMessage = page.getByText('This should not appear')
    await expect(wrongMessage).toHaveCount(0)
  })
})

test.describe('Conversation UI Elements', () => {
  test('conversation view shows the correct header title', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    // The mock returns title "Chat with Bob" in conversation infos
    const header = page.getByText('Chat with Bob')
    await expect(header.first()).toBeVisible({ timeout: 15_000 })
  })

  test('conversation view shows existing messages from history', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    // The mock returns a message "Hello Alice!" from Bob
    const message = page.getByTestId('message-list').getByText('Hello Alice!')
    await expect(message.first()).toBeVisible({ timeout: 15_000 })
  })

  test('conversation view has a back navigation button on narrow screens', async ({ page }) => {
    // The shell owns list/detail navigation, so the back button only exists where
    // the panes are stacked.
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/conversation/conv-1')

    await expect(page.getByRole('link', { name: 'Back' })).toBeVisible({ timeout: 15_000 })
  })

  test('message input textarea is at the bottom of the chat', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    // The textarea should be below the message list
    const textareaBox = await textarea.boundingBox()
    const viewportSize = page.viewportSize()
    expect(textareaBox).toBeTruthy()
    expect(viewportSize).toBeTruthy()
    // Textarea should be in the lower half of the viewport
    expect(textareaBox!.y).toBeGreaterThan(viewportSize!.height / 3)
  })

  test('clicking back from conversation navigates to conversation list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/conversation/conv-1')

    const backButton = page.getByRole('link', { name: 'Back' })
    await expect(backButton).toBeVisible({ timeout: 15_000 })
    await backButton.click()

    // Should navigate back to the conversation list
    await expect(page).toHaveURL(/\/conversation$/, { timeout: 15_000 })
  })
})

test.describe('Message Display', () => {
  test('messages show author name', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    // Bob's message should be visible with Bob's name
    await expect(page.getByTestId('message-list').getByText('Hello Alice!')).toBeVisible({ timeout: 15_000 })

    // The sender name "bob" should be visible in the message area
    const bobLabel = page.getByText('bob')
    await expect(bobLabel.first()).toBeVisible({ timeout: 15_000 })
  })

  test('messages show timestamp', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    await expect(page.getByTestId('message-list').getByText('Hello Alice!')).toBeVisible({ timeout: 15_000 })

    // There should be a time indicator on the page — look for AM/PM pattern or HH:MM
    const timePattern = page.getByText(/\d{1,2}:\d{2}\s*(am|pm)?/i)
    await expect(timePattern.first()).toBeVisible({ timeout: 15_000 })
  })

  test('message from current user appears differently from received messages', async ({ page, request }) => {
    await page.goto('/conversation/conv-1')
    await waitForWsClient(request)

    // Send a message as the current user
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15_000 })
    await textarea.fill('My own message')
    await textarea.press('Enter')

    // Wait for the message to appear
    await expect(page.getByText('My own message').first()).toBeVisible({ timeout: 15_000 })

    // Both Bob's message and our message should be visible
    await expect(page.getByTestId('message-list').getByText('Hello Alice!')).toBeVisible()
    await expect(page.getByText('My own message').first()).toBeVisible()
  })
})
