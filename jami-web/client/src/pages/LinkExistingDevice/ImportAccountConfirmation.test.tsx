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
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ImportAccountConfirmation from './ImportAccountConfirmation.js'

const { passwordFieldProps } = vi.hoisted(() => ({
  passwordFieldProps: [] as { helperText?: string }[],
}))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('../../components/UnconnectedUserLayout.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../../components/JamiWelcomeLogo.js', () => ({ default: () => <div data-testid="jami-welcome-logo" /> }))
vi.mock('../../components/common/PasswordField.js', () => ({
  default: ({ label, helperText }: { label: string; helperText?: string }) => {
    passwordFieldProps.push({ helperText })
    return <input aria-label={label} />
  },
}))
vi.mock('../../contexts/ImportDeviceProvider.js', () => ({
  useImportDeviceContext: () => ({ accountId: 'account-1' }),
}))
vi.mock('../../services/authQueries.js', () => ({
  checkPasswordStrength: () => ({ valueCode: 'valid' }),
  useSetPasswordMutation: () => ({ mutate: vi.fn() }),
}))
vi.mock('./LinkFlowProgress.js', () => ({ default: () => null }))
vi.mock('./useImportFlowGuard.js', () => ({ useImportFlowGuard: vi.fn() }))

describe('ImportAccountConfirmation', () => {
  beforeEach(() => {
    passwordFieldProps.splice(0)
  })

  it('does not render the Jami logo in the password step', () => {
    render(<ImportAccountConfirmation />)

    fireEvent.click(screen.getByRole('button', { name: 'continue' }))

    expect(screen.getByRole('textbox', { name: 'password_input_label' })).toBeInTheDocument()
    expect(screen.queryByTestId('jami-welcome-logo')).not.toBeInTheDocument()
  })

  it('does not reserve helper text space before validation fails', () => {
    render(<ImportAccountConfirmation />)

    fireEvent.click(screen.getByRole('button', { name: 'continue' }))

    expect(passwordFieldProps).toEqual([{ helperText: undefined }, { helperText: undefined }])
  })
})
