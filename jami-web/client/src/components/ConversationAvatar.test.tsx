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
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PresenceContext } from '../contexts/PresenceProvider.js'
import ConversationAvatar, { GroupConversationAvatar } from './ConversationAvatar.js'

const contactQueries = vi.hoisted(() => ({
  useContactProfilePicture: vi.fn(),
}))

const intersectionObserver = vi.hoisted(() => ({
  useInView: vi.fn(() => ({ ref: vi.fn(), inView: true })),
}))

vi.mock('../services/contactQueries.js', () => ({
  useContactProfilePicture: contactQueries.useContactProfilePicture,
}))

vi.mock('react-intersection-observer', () => ({
  useInView: intersectionObserver.useInView,
}))

describe('ConversationAvatar', () => {
  beforeEach(() => {
    contactQueries.useContactProfilePicture.mockClear()
    intersectionObserver.useInView.mockReset()
    intersectionObserver.useInView.mockReturnValue({ ref: vi.fn(), inView: true })
  })

  it('renders an explicit src prop without overriding it from the query', () => {
    contactQueries.useContactProfilePicture.mockReturnValue({ data: undefined })

    render(<ConversationAvatar displayName="Ada" contactUri="" src="data:image/png;base64,abc" />)

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'data:image/png;base64,abc')
  })

  it('falls back to the fetched profile picture when no explicit src is provided', () => {
    contactQueries.useContactProfilePicture.mockReturnValue({ data: 'blob:http://localhost/1234' })

    render(<ConversationAvatar displayName="Ada" contactUri="260d9aaee80c84ffda86bdc579a0be8d07a70b65" />)

    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'blob:http://localhost/1234')
    expect(contactQueries.useContactProfilePicture).toHaveBeenCalledWith(
      '260d9aaee80c84ffda86bdc579a0be8d07a70b65',
      true,
    )
  })

  it('does not fetch a profile picture until the avatar is near the viewport', () => {
    intersectionObserver.useInView.mockReturnValueOnce({ ref: vi.fn(), inView: false })
    contactQueries.useContactProfilePicture.mockReturnValue({ data: undefined })

    render(<ConversationAvatar displayName="Ada" contactUri="260d9aaee80c84ffda86bdc579a0be8d07a70b65" />)

    expect(contactQueries.useContactProfilePicture).toHaveBeenCalledWith(
      '260d9aaee80c84ffda86bdc579a0be8d07a70b65',
      false,
    )
  })

  it('shows the first letter when no profile picture is available', () => {
    contactQueries.useContactProfilePicture.mockReturnValue({ data: undefined })

    render(<ConversationAvatar displayName="Ada" contactUri="260d9aaee80c84ffda86bdc579a0be8d07a70b65" />)

    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('uses a custom group picture before participant avatars', () => {
    contactQueries.useContactProfilePicture.mockReturnValue({ data: undefined })

    render(<GroupConversationAvatar displayName="Design team" members={[]} src="data:image/png;base64,group" />)

    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,group')
  })

  it('falls back to a group icon when a group has no members', () => {
    render(<GroupConversationAvatar displayName="Design team" members={[]} />)

    expect(screen.getByRole('img', { name: 'Design team' })).toBeInTheDocument()
  })

  it('renders a proportional cutaway ring around the online indicator', () => {
    contactQueries.useContactProfilePicture.mockReturnValue({ data: undefined })

    render(
      <PresenceContext value={{ getPresence: () => 1, presence: new Map() }}>
        <ConversationAvatar
          presence
          presenceBackgroundColor="#E5EEF5"
          displayName="Ada"
          contactUri="260d9aaee80c84ffda86bdc579a0be8d07a70b65"
        />
      </PresenceContext>,
    )

    const avatar = screen.getByText('A')
    const indicator = avatar.parentElement?.querySelector('[aria-hidden="true"]')
    expect(indicator).toHaveStyle({
      position: 'absolute',
      right: '-2px',
      bottom: '-2px',
      width: '30%',
      backgroundColor: '#E5EEF5',
    })
    expect(indicator?.firstElementChild).toHaveStyle({
      position: 'absolute',
      inset: '20%',
    })
  })
})
