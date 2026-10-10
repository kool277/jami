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

async function setupAdmin(request: any) {
  await request.post(`${MOCK_API}/__reset`)
  await request.post(`${MOCK_API}/api/admin/create`, {
    data: { password: 'AdminPass123!' },
  })
  await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
    data: { state: 'complete' },
  })
}

test.beforeEach(async ({ page, request }) => {
  await setupAdmin(request)
  await page.addInitScript(() => {
    localStorage.setItem('adminAccessToken', 'mock-admin-token-preset')
  })
})

test('admin can configure local media startup', async ({ page, request }) => {
  await page.goto('/admin/configuration/media')

  await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible()
  await expect(page.getByText('Start without local audio or video device initialization.')).toBeVisible()
  await expect(page.getByText('Change requires a restart.')).toBeVisible()

  const noLocalMediaSwitch = page.getByRole('switch')
  await expect(noLocalMediaSwitch).toBeChecked()

  await noLocalMediaSwitch.click()
  await expect(noLocalMediaSwitch).not.toBeChecked()

  const response = await request.get(`${MOCK_API}/api/admin/config`)
  const config = await response.json()
  expect(config.noLocalMediaEnabled).toBe(false)
})

test('admin can configure conference resolution from media settings', async ({ page, request }) => {
  await page.goto('/admin/configuration/media')

  await expect(page.getByRole('heading', { name: 'Media' })).toBeVisible()
  await expect(page.getByText('Choose the default video resolution used for conference calls.')).toBeVisible()

  const resolutionSelect = page.getByRole('combobox')
  await resolutionSelect.click()
  await page.getByRole('option', { name: 'Full HD 1080p' }).click()

  // Conference resolution is persisted when leaving the section.
  await page.goto('/admin/accounts')

  const response = await request.get(`${MOCK_API}/api/admin/config`)
  const config = await response.json()
  expect(config.conferenceResolution).toBe('1080p')
})
