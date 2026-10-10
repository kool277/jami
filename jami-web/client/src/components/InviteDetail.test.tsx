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
import '../dayjsInitializer.js'

import { ThemeProvider } from '@mui/material/styles'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { type HTMLAttributes } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildDefaultTheme } from '../themes/Default.js'
import InviteDetail from './InviteDetail.js'

const conversationRequest = {
  conversationId: 'request-1',
  infos: { avatar: 'avatar-url', description: 'Study for the exam.', mode: '1', title: 'Study group' },
  from: { uri: '260d9aaee80c84ffda86bdc579a0be8d07a70b65', registeredName: 'ada' },
  received: '1785869460',
  membersNames: ['Ada'],
}
let conversationRequests = [conversationRequest]
let isConversationRequestsPending = false
type MockIconProps = HTMLAttributes<HTMLSpanElement> & { sx?: unknown }

vi.mock('../services/conversationQueries.js', () => ({
  useAcceptConversationRequestMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useBlockConversationRequestMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useConversationRequestsQuery: () => ({
    data: conversationRequests,
    isPending: isConversationRequestsPending,
  }),
  useDeclineConversationRequestMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: { contact?: string }) => {
      const translations = new Map([
        ['conversation_request_ask_join_personalized', 'Hello {{contact}},\nDo you want to join the conversation?'],
        ['conversation_request_has_sent_request', '{{contact}} sent you a conversation invitation.'],
        ['conversation_request_has_sent_group_request', '{{contact}} sent you a group invitation.'],
      ])
      return translations.get(key)?.replace('{{contact}}', values?.contact ?? '') ?? key
    },
  }),
}))

vi.mock('./ConversationAvatar.js', () => ({
  default: ({
    displayName,
    src,
    sx,
  }: {
    displayName: string
    src?: string
    sx?: { width?: string; height?: string }
  }) => (
    <output data-height={sx?.height} data-src={src} data-width={sx?.width}>
      {displayName}
    </output>
  ),
}))

vi.mock('./SvgIcon.js', () => ({
  AccountCircleIcon: () => <span />,
  CheckMarkIcon: () => <span />,
  GroupsIcon: ({ sx: _sx, ...props }: MockIconProps) => <span {...props} />,
  JamiIdIcon: ({ sx: _sx, ...props }: MockIconProps) => <span {...props} />,
  PersonWithCrossMarkIcon: () => <span />,
  SaltireIcon: () => <span />,
}))

describe('InviteDetail', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    isConversationRequestsPending = false
    conversationRequests = [conversationRequest]
  })

  it('shows group invitation context and complete inviter identity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-04T15:00:00Z'))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width =
        this.textContent === 'Ada' || this.textContent === 'Bea'
          ? 24
          : this.textContent === '260d9aaee80c84ffda86bdc579a0be8d07a70b65'
            ? 240
            : 0

      return new DOMRect(0, 0, width, 0)
    })

    const { rerender } = render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe(
      'Ada260d9aaee80c84ffda86bdc579a0be8d07a70b65\nsent you a group invitation.',
    )
    expect(screen.getByText('260d9aaee80c84ffda86bdc579a0be8d07a70b65')).toHaveStyle({
      fontFamily: 'monospace',
    })
    expect(screen.getByTestId('invite-sender-id-icon')).toBeVisible()
    expect(screen.getByTestId('invite-sender-id-container')).toHaveStyle({
      alignItems: 'center',
      display: 'inline-flex',
      height: '24px',
      lineHeight: '0',
    })
    expect(screen.getByTestId('invite-sender-id-icon')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('invite-sender-account-icon')).toBeVisible()
    expect(screen.getByTestId('invite-sender-jami-id-icon')).toHaveStyle({
      clipPath: 'inset(0 100% 0 0)',
    })
    expect(screen.getByTestId('invite-sender-hash')).toHaveStyle({
      clipPath: 'inset(0 100% 0 0)',
      pointerEvents: 'none',
      userSelect: 'none',
    })
    expect(screen.getByTestId('invite-sender-identity-label')).toHaveStyle({ width: '24px' })

    fireEvent.click(screen.getByTestId('invite-sender-id-icon'))

    expect(screen.getByTestId('invite-sender-id-icon')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('invite-sender-account-icon')).toHaveStyle({ position: 'absolute' })
    expect(screen.getByTestId('invite-sender-jami-id-icon')).toHaveStyle({ position: 'static' })
    expect(screen.getByTestId('invite-sender-name')).toHaveStyle({ position: 'absolute' })
    expect(screen.getByTestId('invite-sender-hash')).toHaveStyle({ position: 'static' })
    expect(screen.getByTestId('invite-sender-identity-label')).toHaveStyle({ width: '24px' })

    act(() => vi.advanceTimersByTime(200))

    expect(screen.getByTestId('invite-sender-identity-label')).toHaveStyle({ width: '240px' })

    conversationRequests = [
      {
        ...conversationRequest,
        from: { uri: '8395d8fa96b2d41f0c2dfc4190da7bdc0a6e2de4', registeredName: 'bea' },
        membersNames: ['Bea'],
      },
    ]
    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('invite-sender-id-icon')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('invite-sender-identity-label')).toHaveStyle({ width: '24px' })
    expect(screen.getByTestId('invite-sender-name')).toHaveTextContent('Bea')
    expect(screen.getByTestId('invite-sender-name')).toHaveStyle({ whiteSpace: 'nowrap' })
    expect(screen.getByText('Study group', { selector: 'output' })).toHaveAttribute('data-width', '200px')
    expect(screen.getByTestId('invite-avatar-transition')).toBeVisible()
    expect(screen.getByTestId('invite-group-title')).toHaveTextContent('Study group')
    expect(screen.getByTestId('invite-group-icon')).toBeVisible()
    expect(screen.getByTestId('invite-description')).toHaveTextContent('Study for the exam.')
    expect(screen.getByTestId('invite-description')).toHaveStyle({ fontSize: '0.9375rem', fontWeight: '500' })
    expect(
      screen.getByTestId('invite-group-title').compareDocumentPosition(screen.getByTestId('invite-description')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByTestId('invite-received')).toHaveTextContent(/today.*\d{1,2}:\d{2}\s(?:AM|PM)/i)
    expect(screen.getByTestId('invite-received')).toHaveAttribute('title', '1785869460')
    expect(screen.getByTestId('invite-received').parentElement?.parentElement).toBe(
      screen.getByTestId('invite-summary'),
    )
    expect(screen.getByTestId('invite-received').parentElement).toHaveStyle({
      justifyContent: 'center',
      width: '100%',
    })
    expect(
      screen.getByTestId('invite-description').compareDocumentPosition(screen.getByRole('heading', { level: 4 })),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      screen.getByTestId('invite-description').compareDocumentPosition(screen.getByTestId('invite-received')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      screen
        .getByTestId('invite-received')
        .compareDocumentPosition(screen.getByLabelText('conversation_request_accept')),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows a group invitation card skeleton while loading', () => {
    isConversationRequestsPending = true

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('invite-detail-skeleton')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('invite-detail-skeleton-avatar')).toHaveStyle({ height: '200px', width: '200px' })
    expect(screen.getByTestId('invite-detail-skeleton-group-title')).toBeVisible()
    expect(screen.getByTestId('invite-detail-skeleton-description')).toBeVisible()
    expect(screen.getByTestId('invite-detail-skeleton-actions')).toBeVisible()
  })

  it('uses the direct invitation title as the inviter display name', () => {
    conversationRequest.infos.mode = '0'
    conversationRequest.infos.title = 'Ada Lovelace'
    conversationRequest.membersNames = ['260d9aaee80c84ffda86bdc579a0be8d07a70b65']

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe(
      'Ada Lovelace260d9aaee80c84ffda86bdc579a0be8d07a70b65\nsent you a conversation invitation.',
    )
    expect(screen.queryByTestId('invite-group-title')).not.toBeInTheDocument()
  })

  it('shows the Jami ID icon for a hash-only inviter identity', () => {
    conversationRequests = [
      {
        conversationId: 'request-1',
        infos: { avatar: 'avatar-url', description: '', mode: '0', title: '260d9aaee80c84ffda86bdc579a0be8d07a70b65' },
        from: { uri: '260d9aaee80c84ffda86bdc579a0be8d07a70b65', registeredName: '' },
        received: '1785869460',
        membersNames: ['260d9aaee80c84ffda86bdc579a0be8d07a70b65'],
      },
    ]

    render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('invite-sender-jami-id-icon')).toBeVisible()
    expect(screen.queryByTestId('invite-sender-id-icon')).not.toBeInTheDocument()
  })

  it('cross-fades avatars when the selected invitation changes', () => {
    vi.useFakeTimers()
    conversationRequests = [
      {
        ...conversationRequest,
        infos: { ...conversationRequest.infos, avatar: 'initial-avatar-url', title: 'Initial study group' },
      },
    ]
    const { rerender } = render(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    conversationRequests = [
      {
        ...conversationRequest,
        infos: { ...conversationRequest.infos, avatar: 'next-avatar-url', title: 'Next study group' },
      },
    ]
    rerender(
      <ThemeProvider theme={buildDefaultTheme('light', 'ltr')}>
        <MemoryRouter initialEntries={['/invites/request-1']}>
          <Routes>
            <Route path="/invites/:conversationId" element={<InviteDetail />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByTestId('invite-avatar-transition')).toHaveStyle({ position: 'relative' })
    expect(screen.getByTestId('invite-previous-avatar')).toHaveStyle({ position: 'absolute' })
    expect(screen.getByTestId('invite-previous-avatar')).toHaveTextContent('Initial study group')
    expect(screen.getByTestId('invite-avatar-transition')).toHaveTextContent('Next study group')

    act(() => vi.advanceTimersByTime(200))

    expect(screen.queryByTestId('invite-previous-avatar')).not.toBeInTheDocument()
  })
})
