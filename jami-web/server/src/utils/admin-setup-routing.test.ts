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
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { AdminWizardState, getAdminSetupRedirect } from '@savoirfairelinux/jami-web-common'

describe('getAdminSetupRedirect', () => {
  for (const state of [AdminWizardState.account, AdminWizardState.local, AdminWizardState.jams]) {
    const setupPath = `/admin/setup/${state}`

    it(`redirects an unrelated path to the ${state} setup step`, () => {
      assert.equal(getAdminSetupRedirect('/conversation', state), setupPath)
    })

    it(`allows the canonical ${state} setup path`, () => {
      assert.equal(getAdminSetupRedirect(setupPath, state), undefined)
    })

    it(`redirects another setup path to the ${state} setup step`, () => {
      const expectedPath = state === AdminWizardState.account ? undefined : setupPath
      assert.equal(getAdminSetupRedirect('/admin/setup/account', state), expectedPath)
    })
  }

  it('redirects completed setup paths to admin login', () => {
    assert.equal(getAdminSetupRedirect('/admin/setup/jams', AdminWizardState.complete), '/admin/login')
  })

  it('allows ordinary paths after setup is complete', () => {
    assert.equal(getAdminSetupRedirect('/conversation', AdminWizardState.complete), undefined)
  })
})
