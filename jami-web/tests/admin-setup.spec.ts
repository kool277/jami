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

const MOCK_API = 'http://localhost:5002'

// Reset mock server state and clear client storage before each test
test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__reset`)
  await page.addInitScript(() => {
    localStorage.clear()
  })
})

test.describe.serial('Admin Setup Flow', () => {
  test('redirects to admin setup when server is not configured', async ({ page }) => {
    const response = await page.goto('/')

    expect(response?.request().redirectedFrom()).not.toBeNull()
    await expect(page).toHaveURL(/\/admin\/setup\/account/, { timeout: 30_000 })
  })

  test('admin setup page has password fields', async ({ page }) => {
    await page.goto('/admin/setup/account')
    await expect(page.getByText('Jami Web Admin Setup', { exact: true })).toBeVisible({ timeout: 30_000 })
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput.first()).toBeVisible({ timeout: 30_000 })
  })

  test('admin setup creates account with valid password', async ({ page }) => {
    await page.goto('/admin/setup/account')

    // Wait for the page to be interactive
    const passwordInputs = page.locator('input[type="password"]')
    await expect(passwordInputs.first()).toBeVisible({ timeout: 30_000 })

    // Fill in all password fields
    const count = await passwordInputs.count()
    for (let i = 0; i < count; i++) {
      await passwordInputs.nth(i).fill('SecurePass123!')
    }

    // Submit the form
    const submitButton = page.getByRole('button').filter({ hasText: /.+/ }).first()
    await submitButton.click()

    // Should redirect to the next wizard step (name server setup: /admin/setup/ns)
    await expect(page).toHaveURL(/\/admin\/setup\/ns/, { timeout: 30_000 })
  })
})

test.describe.serial('Admin Login', () => {
  test.beforeEach(async ({ request }) => {
    // Pre-configure: create admin account and mark wizard complete
    await request.post(`${MOCK_API}/api/admin/create`, {
      data: { password: 'AdminPass123!' },
    })
    await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
      data: { state: 'complete' },
    })
  })

  test('shows admin login page with password input', async ({ page }) => {
    await page.goto('/admin/login')
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible({ timeout: 30_000 })
  })

  test('admin login with correct password redirects to admin panel', async ({ page }) => {
    await page.goto('/admin/login')

    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible({ timeout: 30_000 })
    await passwordInput.fill('AdminPass123!')

    const submitButton = page.getByRole('button').filter({ hasText: /.+/ }).first()
    await submitButton.click()

    // Should redirect to admin panel (accounts page)
    await expect(page).toHaveURL(/\/admin\/accounts/, { timeout: 30_000 })
  })

  test('redirects completed setup URLs to admin login', async ({ page }) => {
    await page.goto('/admin/setup/account')
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 30_000 })
  })
})

test.describe('User Login Page', () => {
  test.beforeEach(async ({ request }) => {
    // Setup: ensure admin is configured and wizard is complete
    await request.post(`${MOCK_API}/api/admin/create`, {
      data: { password: 'AdminPass123!' },
    })
    await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
      data: { state: 'complete' },
    })
  })

  test('login page shows password input', async ({ page }) => {
    const setupRequests: string[] = []
    page.on('request', (request) => {
      if (/\/api\/admin\/(check|adminWizardState)$/.test(request.url())) {
        setupRequests.push(request.url())
      }
    })

    await page.goto('/login')
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 30_000 })
    expect(setupRequests).toEqual([])
  })
})
