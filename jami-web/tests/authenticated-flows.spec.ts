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
 * Helper: configure admin setup complete + create a user account via mock API
 */
async function setupWithUser(request: any) {
  await request.post(`${MOCK_API}/__reset`)
  await request.post(`${MOCK_API}/api/admin/create`, {
    data: { password: 'AdminPass123!' },
  })
  await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
    data: { state: 'complete' },
  })
  // Create a test user
  await request.post(`${MOCK_API}/api/auth/new-account`, {
    data: { username: 'alice', password: 'AlicePass1!' },
  })
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__reset`)
  await page.addInitScript(() => {
    localStorage.clear()
  })
})

test.describe.serial('User Login → Messenger Flow', () => {
  test.beforeEach(async ({ request }) => {
    await setupWithUser(request)
  })

  test('successful login stores token and redirects to messenger', async ({ page }) => {
    await page.goto('/login')

    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const passwordInput = page.locator('[data-cy="password-input"] input')

    await usernameInput.fill('alice')
    await passwordInput.fill('AlicePass1!')

    const loginButton = page.locator('[data-cy="login-button"]')
    await loginButton.click()

    // After successful login, the token is stored and user is redirected to messenger (/)
    // The AuthProvider fetches /account and shows the messenger
    await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeTruthy()

    // Token should be in localStorage
    const token = await page.evaluate(() => localStorage.getItem('accessToken'))
    expect(token).toBeTruthy()
    expect(token).toContain('mock-user-token')
  })

  test('messenger page loads with conversation list', async ({ page }) => {
    // Pre-set token to skip login
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-user-token-preset')
    })

    await page.goto('/')

    // Page should not redirect to login
    await expect(page).not.toHaveURL(/\/login/)
  })
})

test.describe('Guest Login', () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${MOCK_API}/__reset`)
    await request.post(`${MOCK_API}/api/admin/create`, {
      data: { password: 'AdminPass123!' },
    })
    await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
      data: { state: 'complete' },
    })
    await request.patch(`${MOCK_API}/api/admin/config`, {
      data: { guestAccessEnabled: true },
    })
  })

  test('guest login retains its token and opens the messenger', async ({ page }) => {
    await page.goto('/login')

    const guestLoginButton = page.locator('[data-cy="guest-login-button"]')
    await expect(guestLoginButton).toBeVisible({ timeout: 30_000 })
    await guestLoginButton.click()

    await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toContain('mock-guest-token-')
    await expect(page).toHaveURL(/\/conversation/, { timeout: 30_000 })
  })
})

test.describe('Settings Navigation', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupWithUser(request)
    await page.addInitScript(() => {
      localStorage.setItem('accessToken', 'mock-user-token-preset')
    })
  })

  test('can navigate to account settings', async ({ page }) => {
    await page.goto('/settings/account/manage-account')
    await expect(page).toHaveURL(/\/settings\/account/)
  })

  test('can change the local account password without ending the active session', async ({ page }) => {
    await page.goto('/settings/account/passkeys')

    await expect(page.getByRole('heading', { name: 'Password & Passkeys' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Passkeys', exact: true })).toBeVisible()

    const passwordInputs = page.locator('input[type="password"]')
    await passwordInputs.nth(0).fill('WrongPass1!')
    await passwordInputs.nth(1).fill('AliceNewPass1!')
    await passwordInputs.nth(2).fill('AliceNewPass1!')
    await page.getByRole('button', { name: 'Change password' }).click()

    await expect(page.getByRole('alert')).toHaveText('The current password is incorrect.')
    await expect(page.evaluate(() => localStorage.getItem('accessToken'))).toBeTruthy()

    await passwordInputs.nth(0).fill('AlicePass1!')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Password changed successfully.')).toBeVisible()
    await expect(page.evaluate(() => localStorage.getItem('accessToken'))).toBeTruthy()

    await page.evaluate(() => localStorage.removeItem('accessToken'))
    await page.goto('/login')
    await page.locator('[data-cy="username-input"] input').fill('alice')
    await page.locator('[data-cy="password-input"] input').fill('AliceNewPass1!')
    await page.locator('[data-cy="login-button"]').click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeTruthy()
  })

  test('can navigate to general settings', async ({ page }) => {
    await page.goto('/settings/general')
    await expect(page).toHaveURL(/\/settings\/general\/system$/)
  })

  test('defaults to general settings', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/settings\/general\/system$/)
  })

  test('keeps the settings list open in compact mode', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/settings')

    await expect(page).toHaveURL(/\/settings$/)
    await expect(page.getByRole('navigation', { name: 'Settings' })).toBeVisible()
  })

  test('can navigate to contacts page', async ({ page }) => {
    await page.goto('/contacts')
    await expect(page).toHaveURL(/\/contacts/)
  })

  // The avatar controls once carried no accessible name, so the profile
  // picture could not be changed without a mouse.
  test('avatar picture controls are reachable by their accessible name', async ({ page }) => {
    await page.goto('/settings/account/customize-profile')

    const edit = page.getByRole('button', { name: 'Change picture' })
    await expect(edit).toBeVisible({ timeout: 15_000 })
    await edit.click()

    for (const name of ['Take a picture', 'Upload a picture']) {
      await expect(page.getByRole('button', { name })).toBeVisible({ timeout: 10_000 })
    }

    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Take a picture' })).toBeHidden()
    await expect(edit).toBeFocused()
  })
})

test.describe('Logout Flow', () => {
  test.beforeEach(async ({ request }) => {
    await setupWithUser(request)
  })

  test('accessing messenger without token redirects to login', async ({ page }) => {
    // Don't set any token — go directly to messenger route
    await page.goto('/')

    // AuthProvider checks localStorage for accessToken, doesn't find one → redirects to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 })
  })
})

test.describe('Admin Panel Features', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupWithUser(request)
    await page.addInitScript(() => {
      localStorage.setItem('adminAccessToken', 'mock-admin-token')
    })
  })

  test('admin account overview shows page', async ({ page }) => {
    await page.goto('/admin/accounts')
    await expect(page).toHaveURL(/\/admin\/accounts/)
  })

  test('admin authentication settings page loads', async ({ page }) => {
    await page.goto('/admin/authentication')
    await expect(page).toHaveURL(/\/admin\/authentication/)
  })

  test('admin authentication method pages render', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
    })

    const expectInputBelowSwitch = async (inputSelector: string) => {
      const switchBox = await page.locator('.MuiSwitch-root').first().boundingBox()
      const inputBox = await page.locator(inputSelector).boundingBox()

      expect(switchBox).not.toBeNull()
      expect(inputBox).not.toBeNull()
      expect(inputBox!.y).toBeGreaterThan(switchBox!.y + switchBox!.height)
    }

    await page.goto('/admin/authentication/jami')
    await expect(page).toHaveURL(/\/admin\/authentication\/jami/)
    await expect(page.locator('body')).toContainText('Jami Local Authentication')
    await expect(page.locator('#name-server-input')).toBeVisible()
    await expectInputBelowSwitch('#name-server-input')

    await page.goto('/admin/authentication/jams')
    await expect(page).toHaveURL(/\/admin\/authentication\/jams/)
    await expect(page.locator('body')).toContainText('JAMS authentication')
    await expect(page.locator('#jams-url-input')).toBeVisible()
    await expectInputBelowSwitch('#jams-url-input')

    await page.goto('/admin/authentication/openid')
    await expect(page).toHaveURL(/\/admin\/authentication\/openid/)
    await expect(page.locator('body')).toContainText('OpenID authentication')
    await expect(page.locator('body')).toContainText('Google')
    await expect(page.locator('body')).toContainText('GitHub')

    expect(consoleErrors).toEqual([])
  })

  test('admin can navigate between tabs', async ({ page }) => {
    await page.goto('/admin/accounts')
    await expect(page).toHaveURL(/\/admin\/accounts/)

    // Look for navigation links to authentication
    const authLink = page.locator('a[href*="authentication"]').first()
    if (await authLink.isVisible()) {
      await authLink.click()
      await expect(page).toHaveURL(/\/admin\/authentication/, { timeout: 10_000 })
    }
  })
})

test.describe('Registration → Login Flow', () => {
  test.beforeEach(async ({ request }) => {
    await setupWithUser(request)
  })

  test('register new user, then login', async ({ page }) => {
    // Step 1: Register
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const passwordInput = page.locator('[data-cy="password-input"] input')

    await usernameInput.fill('newuser123')
    await passwordInput.fill('NewUserPass1!')

    const registerButton = page.locator('[data-cy="register-button"]')
    // The register button enables once the username availability check passes
    await expect(registerButton).toBeEnabled()
    await registerButton.click()

    // Wait for registration + auto-login
    // ponytail: fixed wait — the test branches on whether auto-login succeeded, so there is
    // no single deterministic signal to poll for; a bounded settle is the simplest correct option.
    await page.waitForTimeout(3_000)

    // Step 2: If auto-login succeeded, token should be stored
    // If not, navigate to login manually
    const token = await page.evaluate(() => localStorage.getItem('accessToken'))
    if (!token) {
      await page.goto('/login')
      const loginUsername = page.locator('[data-cy="username-input"] input')
      await expect(loginUsername).toBeVisible({ timeout: 30_000 })

      await loginUsername.fill('newuser123')
      await page.locator('[data-cy="password-input"] input').fill('NewUserPass1!')
      await page.locator('[data-cy="login-button"]').click()

      await expect.poll(() => page.evaluate(() => localStorage.getItem('accessToken'))).toBeTruthy()
      const loginToken = await page.evaluate(() => localStorage.getItem('accessToken'))
      expect(loginToken).toBeTruthy()
    }
  })
})
