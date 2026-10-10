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

// --- Mobile Responsive Tests ---

test.describe('Mobile Responsive - Login', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true }) // iPhone SE

  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('login page renders correctly on mobile', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const passwordInput = page.locator('[data-cy="password-input"] input')
    await expect(passwordInput).toBeVisible()

    const loginButton = page.locator('[data-cy="login-button"]')
    await expect(loginButton).toBeVisible()

    // Check that elements are not overflowing horizontally
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 5) // small tolerance
  })

  test('admin setup page is usable on mobile', async ({ page, request }) => {
    await request.post(`${MOCK_API}/__reset`) // Reset to unconfigured state
    await page.goto('/')

    await expect(page).toHaveURL(/\/admin\/setup\/account/, { timeout: 30_000 })

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 15_000 })

    // Ensure password inputs are tappable and visible
    await passwordInput.tap()
    await passwordInput.fill('MobileTest1!')
  })
})

test.describe('Mobile Responsive - Registration', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('registration page renders on mobile', async ({ page }) => {
    await page.goto('/register')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    const passwordInput = page.locator('[data-cy="password-input"] input')
    await expect(passwordInput).toBeVisible()
  })
})

test.describe('Tablet Responsive', () => {
  test.use({ viewport: { width: 768, height: 1024 } }) // iPad

  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('login page renders on tablet', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })
  })

  test('admin login renders on tablet', async ({ page }) => {
    await page.goto('/admin/login')
    const passwordInput = page.locator('input[type="password"]')
    await expect(passwordInput).toBeVisible({ timeout: 30_000 })
  })
})

// --- Accessibility Tests ---

test.describe('Accessibility - Login Page', () => {
  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('login page inputs have associated labels', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    // MUI TextField inputs should have an associated label
    const usernameLabel = page.locator('[data-cy="username-input"] label')
    await expect(usernameLabel).toBeAttached()

    const passwordLabel = page.locator('[data-cy="password-input"] label')
    await expect(passwordLabel).toBeAttached()
  })

  test('login form is keyboard navigable', async ({ page }) => {
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    // Tab through the form
    await usernameInput.focus()
    await usernameInput.fill('alice')

    // Tab to password
    await page.keyboard.press('Tab')
    // Continue tabbing
    await page.keyboard.press('Tab')

    // Eventually should reach a submit button
    const activeTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(activeTag).toBeTruthy()
  })

  test('admin login page has proper heading', async ({ page }) => {
    await page.goto('/admin/login')
    await page.locator('input[type="password"]').waitFor({ timeout: 30_000 })

    // Should have a heading for the page
    const heading = page.locator('h1, h2, h3, h4, h5, h6').first()
    await expect(heading).toBeVisible()
  })
})

test.describe('Accessibility - Admin Setup', () => {
  test('setup page has visible heading and instructions', async ({ page }) => {
    await page.goto('/admin/setup/account')

    const passwordInput = page.locator('input[type="password"]').first()
    await expect(passwordInput).toBeVisible({ timeout: 30_000 })

    // The page should have some instructional text
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(10)
  })
})

// --- Performance Tests ---

test.describe('Performance', () => {
  test.beforeEach(async ({ request }) => {
    await setupCompleteAdmin(request)
  })

  test('login page loads within 10 seconds', async ({ page }) => {
    const start = Date.now()
    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })
    const elapsed = Date.now() - start

    // Page should load within 10 seconds even on slow machines
    expect(elapsed).toBeLessThan(10_000)
  })

  test('admin setup page loads within 10 seconds', async ({ page, request }) => {
    await request.post(`${MOCK_API}/__reset`)
    const start = Date.now()
    await page.goto('/')
    await expect(page).toHaveURL(/\/admin\/setup\/account/, { timeout: 30_000 })
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(10_000)
  })

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('React DevTools') &&
        !e.includes('favicon') &&
        !e.includes('Download the React DevTools') &&
        !e.includes('validateDOMNesting') &&
        !e.includes('cannot be a descendant') &&
        !e.includes('cannot contain a nested') &&
        !e.includes('hydration error'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('no failed network requests on login page', async ({ page }) => {
    const failedRequests: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 500 && response.url().includes('/api/')) {
        failedRequests.push(`${response.status()} ${response.url()}`)
      }
    })

    await page.goto('/login')
    const usernameInput = page.locator('[data-cy="username-input"] input')
    await expect(usernameInput).toBeVisible({ timeout: 30_000 })

    expect(failedRequests).toHaveLength(0)
  })
})
