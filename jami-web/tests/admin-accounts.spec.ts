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

async function setupAdmin(request: any) {
  await request.post(`${MOCK_API}/__reset`)
  await request.post(`${MOCK_API}/api/admin/create`, {
    data: { password: 'AdminPass123!' },
  })
  await request.post(`${MOCK_API}/api/admin/admin-wizard-state`, {
    data: { state: 'complete' },
  })
}

test.describe('Admin Accounts Management', () => {
  test.beforeEach(async ({ page, request }) => {
    await setupAdmin(request)
    await page.addInitScript(() => {
      localStorage.setItem('adminAccessToken', 'mock-admin-token-preset')
    })
  })

  test('add and delete an account', async ({ page }) => {
    // 1. Visit `/admin/accounts`.
    await page.goto('/admin/accounts')

    // 2. Click the visible `Add account` button.
    await page.getByRole('button', { name: 'Add account' }).click()

    // 3. Fill username `managed-user`, password and confirmation `ManagedPass123!`.
    const accountDialog = page.getByRole('dialog')
    await accountDialog.getByRole('textbox', { name: 'Username' }).fill('managed-user')
    await accountDialog.getByRole('textbox', { name: 'Password', exact: true }).fill('ManagedPass123!')
    await accountDialog.getByRole('textbox', { name: 'Repeat password', exact: true }).fill('ManagedPass123!')

    // 4. Submit the account form and assert the account appears in the account table.
    const createAccountButton = accountDialog.getByRole('button', { name: 'Create account' })
    await expect(createAccountButton).toBeEnabled()
    await createAccountButton.click()
    const accountRow = page.locator('tbody tr').filter({ hasText: 'managed-user' })
    await expect(accountRow).toBeVisible()

    // 5. Open the account's `Account actions` menu, choose `Remove`, and confirm deletion in the existing confirmation dialog.
    await accountRow.getByRole('button', { name: 'Account actions' }).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()
    const confirmationDialog = page.getByRole('dialog')
    await confirmationDialog.getByRole('button', { name: 'Remove' }).click()

    // 6. Assert `managed-user` no longer appears.
    await expect(page.locator('tbody tr').filter({ hasText: 'managed-user' })).toHaveCount(0)
  })
})
