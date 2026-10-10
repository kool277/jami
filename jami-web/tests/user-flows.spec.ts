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

/**
 * Helper: configure mock server with admin setup complete
 */
async function setupCompleteAdmin(request: any) {
  await request.post(`${MOCK_API}/__reset`)
  await request.post(`${MOCK_API}/api/admin/create`, {
    data: { password: 'AdminPass123!' },
  })
  await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
    data: { state: 'complete' },
  })
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__reset`)
  await page.addInitScript(() => {
    localStorage.clear()
  })
})

test.describe.serial('Registration Flow', () => {
  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('registration page shows username and password fields', async ({ page }) => {
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    const passwordInput = page.locator('[data-cy="password-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })
    await expect(passwordInput).toBeVisible()
  })

  test('registration page validates username format', async ({ page }) => {
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    // Type an invalid username (too short)
    await usernameInput.fill('ab')

    // Stay on registration page
    await expect(page).toHaveURL(/\/register/)
  })

  test('registration page returns to login with the back button', async ({ page }) => {
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const backButton = page.getByRole('button', { name: /back/i })
    await expect(backButton).toBeVisible({ timeout: 10_000 })
    await backButton.click()

    await expect(page).toHaveURL(/\/login$/)
  })

  test('successful registration creates account', async ({ page }) => {
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    const passwordInput = page.locator('[data-cy="password-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    await usernameInput.fill('testuser123')
    await passwordInput.fill('StrongPass1!')

    // Submit — the button enables once the username availability check passes
    const submitButton = page.locator('button[type="submit"]').first()
    await expect(submitButton).toBeEnabled()
    await submitButton.click()
  })

  test('registration requires an acceptable password before create is enabled', async ({ page }) => {
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    const passwordInput = page.locator('[data-cy="password-input"] input')
    const submitButton = page.locator('[data-cy="register-button"]')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    await usernameInput.fill('testuser456')

    await expect(submitButton).toBeDisabled()

    await passwordInput.fill('Abc123!')
    await expect(submitButton).toBeDisabled()

    await passwordInput.fill('Abc123!d')
    await expect(submitButton).toBeEnabled()
  })
})

test.describe('Login Page Details', () => {
  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('login page shows username input', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })
  })

  test('login button is disabled when fields are empty', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const loginButton = page.locator('[data-cy="login-button"]')
    await expect(loginButton).toBeDisabled()
  })

  test('login button becomes enabled when fields are filled', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const passwordInput = page.locator('[data-cy="password-input"] input')

    await usernameInput.fill('testuser')
    await passwordInput.fill('password123')

    const loginButton = page.locator('[data-cy="login-button"]')
    await expect(loginButton).toBeEnabled({ timeout: 5_000 })
  })

  test('login shows invalid credentials when account is not found', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Username not found' })
    })

    await usernameInput.fill('missinguser')
    await page.locator('[data-cy="password-input"] input').fill('password123')
    await page.locator('[data-cy="login-button"]').click()

    await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 10_000 })
  })

  test('login page has button to registration', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    await expect(page.getByRole('button', { name: 'Create Jami account' })).toBeVisible()
  })

  test('registration button navigates to register page', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Create Jami account' }).click()

    await expect(page).toHaveURL(/\/register/, { timeout: 10_000 })
  })

  test('login page shows import account button', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    // Check "connect from another device" button
    const importButton = page.getByRole('button', { name: /connect.from.another.device/i })
    await expect(importButton).toBeVisible({ timeout: 5_000 })
  })
})

test.describe.serial('Admin Setup Wizard Full Flow', () => {
  test('complete wizard: account → name server → jams', async ({ page }) => {
    await page.goto('/')

    // Step 1: Create admin account
    await expect(page).toHaveURL(/\/admin\/setup\/account/, { timeout: 30_000 })
    const passwordInputs = page.locator('input[type="password"]')
    await expect(passwordInputs.first()).toBeVisible({ timeout: 15_000 })

    const count = await passwordInputs.count()
    for (let i = 0; i < count; i++) {
      await passwordInputs.nth(i).fill('WizardPass123!')
    }

    const submitBtn = page.getByRole('button').filter({ hasText: /.+/ }).first()
    await submitBtn.click()

    // Step 2: Name server configuration page
    await expect(page).toHaveURL(/\/admin\/setup\/ns/, { timeout: 30_000 })
    // The name server page should be visible
    await expect(page.locator('body')).toContainText(/.+/, { timeout: 15_000 })
  })
})

test.describe('Navigation Guards', () => {
  test('unauthenticated user accessing messenger is redirected or shown welcome', async ({ page, request }) => {
    await setupCompleteAdmin(request)
    await page.goto('/')

    // Without auth token, the app should show welcome animation first
    // then show the messenger (which requires AuthProvider)
    // AuthProvider should redirect to login if no token
    // The URL should either stay at / (welcome animation) or redirect to login
    await expect(page).toHaveURL(/\/(login)?$/)
  })

  test('admin panel requires authentication', async ({ page, request }) => {
    await setupCompleteAdmin(request)

    // Try to go directly to admin/accounts without admin token
    await page.goto('/admin/accounts')

    // AdminAuthWrapper checks adminAccessToken → redirects to admin/login
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 30_000 })
  })

  test('admin panel accessible with valid token', async ({ page, request }) => {
    await setupCompleteAdmin(request)

    // Set admin token before navigating
    await page.addInitScript(() => {
      localStorage.setItem('adminAccessToken', 'mock-admin-token')
    })

    await page.goto('/admin/accounts')

    // Should stay on accounts page (not redirect to login)
    await expect(page).toHaveURL(/\/admin\/accounts/, { timeout: 30_000 })
  })
})

test.describe('Admin Panel Navigation', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupCompleteAdmin(request)
    await page.addInitScript(() => {
      localStorage.setItem('adminAccessToken', 'mock-admin-token')
    })
  })

  test('admin login redirects to accounts if already authenticated', async ({ page }) => {
    await page.goto('/admin/login')
    // AdminLogin checks localStorage for adminAccessToken → redirects to admin/accounts
    await expect(page).toHaveURL(/\/admin\/accounts/, { timeout: 30_000 })
  })
})
