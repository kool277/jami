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

test.describe('RTL and Debug Tools Audit', () => {
  test.use({ colorScheme: 'light', locale: 'en-US' })

  test.beforeEach(async ({ page, request }) => {
    await request.post(`${MOCK_API}/__reset`)
    await request.post(`${MOCK_API}/api/admin/create`, {
      data: { password: 'AdminPass123!' },
    })
    await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
      data: { state: 'complete' },
    })
    await request.post(`${MOCK_API}/api/auth/new-account`, {
      data: { username: 'rtl-audit-user', password: 'RtlAuditPass1!' },
    })
    await page.route('**/api/config/languages', (route) =>
      route.fulfill({
        json: [
          { tag: 'en', fullName: 'English' },
          { tag: 'ar', fullName: 'Arabic' },
        ],
      }),
    )
    await page.route('**/api/config/languages/ar/', (route) => route.fulfill({ json: {} }))
    // The development server can be paired with an externally running API
    // whose token validation differs from tests/mock-server.ts. Fulfil the
    // authenticated bootstrap request so this audit can exercise the real
    // settings UI without relying on that external authentication state.
    await page.route('**/api/account', (route) =>
      route.fulfill({
        json: {
          id: 'mock-account-id',
          details: {
            'Account.id': 'mock-account-id',
            'Account.type': 'RING',
            'Account.alias': 'RTL audit user',
            'Account.displayName': 'RTL audit user',
            'Account.username': 'rtl-audit-user',
            'Account.deviceID': 'mock-device-id',
            'Account.deviceName': 'Mock Device',
            'Account.enable': 'true',
            'Account.videoEnabled': 'true',
            'Account.autoAnswer': 'false',
            'Account.rendezVous': 'false',
            'RingNS.uri': '',
          },
          volatileDetails: {
            'Account.registeredName': 'rtl-audit-user',
            'Account.registrationStatus': 'REGISTERED',
          },
          defaultModerators: [],
          devices: { 'mock-device-id': 'Mock Device' },
        },
      }),
    )
    // Keep the authenticated settings shell mounted. Its shared footer and
    // providers also request contacts/conversation preferences, which the
    // externally running development API rejects for the synthetic token.
    await page.route('**/api/contacts**', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/conversations/**', (route) => route.fulfill({ json: {} }))
    await page.addInitScript(() => {
      localStorage.clear()
      // The narrow settings screen gives this audit a real directional
      // MaterialSymbol (the shell back button) and a non-directional one
      // (the Settings destination in the navigation bar).
      localStorage.setItem('accessToken', 'mock-user-token-preset')
    })
  })

  test('Verify debug tools and RTL/theme reset behavior', async ({ page }) => {
    // 1. Open a real authenticated app surface at `?debug-tools=1` in development.
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/settings/general?debug-tools=1')
    await expect(page).toHaveURL(/\/settings\/general\/system\?debug-tools=1$/)

    // 2. Verify the Debug Tools control is visible.
    const debugTools = page.getByRole('dialog', { name: 'Debug tools' })
    await expect(debugTools).toBeVisible()

    // These are real MaterialSymbol surfaces, not test-only hooks. `arrow_back`
    // is marked bidirectional while `settings` is intentionally not.
    const directionalSymbol = page
      .locator('.material-symbols-outlined')
      .filter({ hasText: /^arrow_back$/ })
      .locator('span')
    const nonDirectionalSymbol = page
      .locator('.material-symbols-outlined')
      .filter({ hasText: /^settings$/ })
      .locator('span')
    await expect(directionalSymbol).toBeVisible()
    await expect(nonDirectionalSymbol).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.fonts.check('24px "Material Symbols Outlined"'))).toBe(true)
    await expect(directionalSymbol).toHaveCSS('transform', 'none')
    await expect(nonDirectionalSymbol).toHaveCSS('transform', 'none')

    // 3. Choose an RTL language and verify language, automatic direction, and
    // directional-only MaterialSymbol mirroring. Keyboard selection avoids the
    // draggable dialog's Reset button overlapping the portalled menu option.
    const language = debugTools.getByRole('combobox', { name: 'Language' })
    await language.click()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    const documentElement = page.locator('html')
    await expect(documentElement).toHaveAttribute('lang', 'ar')
    await expect(documentElement).toHaveAttribute('dir', 'rtl')
    await expect(directionalSymbol).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)')
    await expect(nonDirectionalSymbol).toHaveCSS('transform', 'none')

    // 4. The RTL switch overrides the language-derived automatic direction.
    const rtl = debugTools.getByRole('switch', { name: 'RTL' })
    await expect(rtl).toBeChecked()
    await rtl.click()
    await expect(rtl).not.toBeChecked()
    await expect(documentElement).toHaveAttribute('dir', 'ltr')
    await expect(directionalSymbol).toHaveCSS('transform', 'none')

    // 5. Toggle dark mode and verify the active theme changes to dark.
    const darkMode = debugTools.getByRole('switch', { name: 'Dark mode' })
    await darkMode.click()
    await expect(darkMode).toBeChecked()
    await expect(documentElement).toHaveCSS('color-scheme', 'dark')

    // 6. Reset returns language, automatic direction, and preferred theme.
    await debugTools.getByRole('button', { name: 'Reset' }).click()
    await expect(documentElement).toHaveAttribute('lang', 'en')
    await expect(documentElement).toHaveAttribute('dir', 'ltr')
    await expect(darkMode).not.toBeChecked()
    await expect(documentElement).toHaveCSS('color-scheme', 'light')
    await expect(directionalSymbol).toHaveCSS('transform', 'none')
    await expect(nonDirectionalSymbol).toHaveCSS('transform', 'none')
  })
})
