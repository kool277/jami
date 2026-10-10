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
import { expect, test } from '@playwright/test'

const MOCK_API = 'http://localhost:5002'
const DANA_URI = '260d9aaee80c84ffda86bdc579a0be8d07a70b65'

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__reset`)
  await request.post(`${MOCK_API}/api/admin/create`, { data: { password: 'AdminPass123!' } })
  await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, { data: { state: 'complete' } })
  await request.post(`${MOCK_API}/api/auth/new-account`, { data: { username: 'alice', password: 'AlicePass1!' } })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('accessToken', 'mock-user-token-preset')
  })
})

test.describe('Inviting a peer from the search results', () => {
  test('opens the chat of a searched account instead of a dialog', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('searchbox').fill('dana')
    await page.getByText('dana').first().click()

    await expect(page).toHaveURL(new RegExp(`/conversation/new/${DANA_URI}$`))
    await expect(page.getByRole('button', { name: /dana/i }).first()).toHaveClass(/Mui-selected/)
    await expect(page.getByText('Send a message to invite this person to a conversation.')).toBeVisible()
  })

  test('reaches the same chat directly through its URL', async ({ page }) => {
    await page.goto(`/conversation/new/${DANA_URI}`)

    await expect(page.getByText('Send a message to invite this person to a conversation.')).toBeVisible()
    await expect(page.getByRole('searchbox')).toHaveValue(DANA_URI)

    await page.getByRole('searchbox').fill('')

    await expect(page).toHaveURL(new RegExp(`/conversation/new/${DANA_URI}$`))
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(page.getByText('Send a message to invite this person to a conversation.')).toBeVisible()

    const bobConversation = page.getByRole('button', { name: /Bob/i }).first()
    await expect(bobConversation).toBeVisible()
    await expect(bobConversation).not.toHaveClass(/Mui-selected/)
  })

  test('keeps the pending chat open while clearing the search', async ({ page }) => {
    await page.goto('/conversation/conv-1')

    await page.getByRole('searchbox').fill('dana')
    await page.getByText('dana').first().click()
    await expect(page).toHaveURL(new RegExp(`/conversation/new/${DANA_URI}$`))

    await page.getByRole('searchbox').fill('')

    await expect(page).toHaveURL(new RegExp(`/conversation/new/${DANA_URI}$`))
    await expect(page.getByRole('searchbox')).toHaveValue('')
    await expect(page.getByText('Send a message to invite this person to a conversation.')).toBeVisible()

    const bobConversation = page.getByRole('button', { name: /Bob/i }).first()
    await expect(bobConversation).toBeVisible()
    await expect(bobConversation).not.toHaveClass(/Mui-selected/)
  })

  test('sends the invitation when the first message is sent', async ({ page, request }) => {
    await page.goto(`/conversation/new/${DANA_URI}`)
    await expect(page.getByText('Send a message to invite this person to a conversation.')).toBeVisible()

    await page.getByRole('textbox').last().fill('Hi Dana!')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/conversation/conv-invited-${DANA_URI}$`))
    await expect
      .poll(async () => (await (await request.get(`${MOCK_API}/__invited-contacts`)).json()).length)
      .toBeGreaterThan(0)
  })

  test('opens the chat even when the name server never answers', async ({ page }) => {
    // A daemon that cannot reach the name server leaves the lookup pending
    // forever, which must not keep the chat of a known address hidden.
    await page.route('**/api/ns/address/**', () => {})

    await page.goto(`/conversation/new/${DANA_URI}`)

    await expect(page.getByText('Send a message to invite this person to a conversation.')).toBeVisible()
  })

  test('shows the existing conversation of a peer that is already a contact', async ({ page }) => {
    await page.goto('/conversation/new/contact-bob-uri')

    await expect(page).toHaveURL(/\/conversation\/conv-1$/)
  })
})
