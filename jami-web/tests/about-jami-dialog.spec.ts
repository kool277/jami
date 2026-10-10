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
import { APIRequestContext, expect, test } from '@playwright/test'

declare global {
  interface Window {
    openCalls?: Array<[string, string | undefined]>
  }
}

const MOCK_API = process.env.MOCK_API_URL ?? 'http://localhost:5002'

async function setupAuthenticatedUser(request: APIRequestContext) {
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

test.describe('About Jami dialog', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAuthenticatedUser(request)
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('accessToken', 'mock-user-token-preset')
    })
  })

  test('closes with Escape and backdrop click', async ({ page }) => {
    // 1. Navigate to the production messenger welcome page.
    await page.goto('/')

    // 2. Open the About Jami dialog.
    const aboutJamiButton = page.getByRole('button', { name: 'About Jami' })
    await expect(aboutJamiButton).toBeVisible({ timeout: 15_000 })
    await aboutJamiButton.click()
    const dialog = page.getByRole('dialog', { name: 'About Jami' })
    await expect(dialog).toBeVisible()

    // 3. Verify the dialog closes when Escape is pressed.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // 4. Reopen the About Jami dialog.
    await aboutJamiButton.click()
    await expect(dialog).toBeVisible()

    // 5. Verify the dialog closes when its backdrop is clicked.
    await page.locator('.MuiDialog-container').click({ position: { x: 1, y: 1 } })
    await expect(dialog).toBeHidden()
  })

  test('copies the displayed version payload to the clipboard', async ({ context, page }) => {
    // 1. Navigate to the production messenger welcome page with clipboard permissions.
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')

    // 2. Open the About Jami dialog.
    const aboutJamiButton = page.getByRole('button', { name: 'About Jami' })
    await expect(aboutJamiButton).toBeVisible({ timeout: 15_000 })
    await aboutJamiButton.click()
    const dialog = page.getByRole('dialog', { name: 'About Jami' })
    await expect(dialog).toBeVisible()

    // 3. Read the displayed GitHash-CoreVersion payload.
    const gitHash = (await dialog.getByText(/^Version\s*:/).innerText()).replace(/^Version\s*:\s*/, '').trim()
    const coreVersion = (await dialog.getByText(/^Core:/).innerText()).replace(/^Core:\s*/, '').trim()
    const versionPayload = `${gitHash}-${coreVersion}`

    // 4. Click the version copy control.
    await dialog.getByRole('button', { name: 'Copy to clipboard' }).click()

    // 5. Verify the clipboard contains the displayed payload and the existing copy confirmation is shown.
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(versionPayload)
    await expect(page.getByText('Copied to clipboard.')).toBeVisible()
  })

  test('does not show copy success when clipboard writing is rejected', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error('Clipboard denied')) },
      })
    })
    await page.goto('/')

    await page.getByRole('button', { name: 'About Jami' }).click()
    const dialog = page.getByRole('dialog', { name: 'About Jami' })
    await dialog.getByRole('button', { name: 'Copy to clipboard' }).click()

    await expect(page.getByText('Copied to clipboard.')).not.toBeVisible()
  })

  test('opens the intended Donate, Contribute, and Feedback destinations', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => {
      window.openCalls = []
      window.open = (url, target) => {
        window.openCalls?.push([url?.toString() ?? '', target])
        return null
      }
    })

    await page.getByRole('button', { name: 'About Jami' }).click()
    const dialog = page.getByRole('dialog', { name: 'About Jami' })
    await dialog.getByRole('button', { name: 'Donate' }).click()
    await dialog.getByRole('button', { name: 'Contribute' }).click()
    await dialog.getByRole('button', { name: 'Feedback' }).click()

    await expect
      .poll(() => page.evaluate(() => window.openCalls ?? []))
      .toEqual([
        ['https://jami.net/donate/', '_blank'],
        ['https://jami.net/contribute/', '_blank'],
        ['mailto:jami@gnu.org', undefined],
      ])
  })

  test('moves focus into the dialog and returns it to the launcher after closing', async ({ page }) => {
    await page.goto('/')

    const launcher = page.getByRole('button', { name: 'About Jami' })
    await launcher.click()
    const dialog = page.getByRole('dialog', { name: 'About Jami' })
    await expect(dialog).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(launcher).toBeFocused()
  })

  test.describe('on mobile', () => {
    test.use({ viewport: { width: 375, height: 667 }, hasTouch: true })

    test('keeps dialog controls within the viewport', async ({ page }) => {
      await page.goto('/')

      // Narrow screens show the conversation list, so About Jami is reached
      // through the account menu in the navigation bar.
      await page.getByRole('button', { name: 'Account' }).click()
      const aboutJamiButton = page.getByRole('menuitem', { name: 'About Jami' })
      await aboutJamiButton.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'About Jami' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Copy to clipboard' })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Feedback' })).toBeVisible()

      const dialogBox = await dialog.boundingBox()
      const viewport = page.viewportSize()
      expect(dialogBox).not.toBeNull()
      expect(viewport).not.toBeNull()
      expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width)
    })
  })
})
