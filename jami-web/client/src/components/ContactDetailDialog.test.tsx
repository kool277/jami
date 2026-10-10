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
import type { ContactDetails } from '@savoirfairelinux/jami-web-common'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import ContactDetailDialog from './ContactDetailDialog.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('./ConversationAvatar.js', () => ({
  default: ({ displayName }: { displayName: string }) => (
    <span data-testid="contact-avatar">{displayName.slice(0, 1)}</span>
  ),
}))

vi.mock('./ContactIdentity.js', () => ({
  IdentifierText: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('./Dialog.js', () => ({
  DialogContentList: ({ items }: { items: Array<{ label?: string; value: ReactNode }> }) => (
    <div>
      {items.map(({ label, value }) => (
        <div key={label}>
          {label}
          {value}
        </div>
      ))}
    </div>
  ),
  InfosDialog: ({ icon, title, content }: { icon?: ReactNode; title: string; content: ReactNode }) => (
    <div>
      {icon}
      <h1>{title}</h1>
      {content}
    </div>
  ),
}))

vi.mock('./JamiQrCode.js', () => ({
  default: () => null,
}))

vi.mock('./Loading.js', () => ({
  default: () => null,
}))

describe('ContactDetailDialog', () => {
  it('falls back to the contact identifier when no contact name is available', () => {
    const contactDetail = {
      id: 'contact-id',
      conversationId: 'conversation-id',
      added: '',
      confirmed: '',
    } as ContactDetails

    expect(() =>
      render(<ContactDetailDialog contactDetail={contactDetail} open={true} onClose={vi.fn()} />),
    ).not.toThrow()
    expect(screen.getByTestId('contact-avatar')).toHaveTextContent('c')
    expect(screen.getByRole('heading', { name: 'contact-id' })).toBeVisible()
    expect(screen.getByText('contact_details_namecontact-id')).toBeVisible()
  })
})
