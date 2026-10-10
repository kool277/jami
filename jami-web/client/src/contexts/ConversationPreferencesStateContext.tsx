/*
 * Copyright (C) 2024 Savoir-faire Linux Inc.
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
import { useMemo, useState } from 'react'

import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { WithChildren } from '../utils/utils.js'

interface ConversationPreferencesStateContext {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  isSearchOpen: boolean
  setIsSearchOpen: (value: boolean) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
}

const optionalConversationPreferencesStateContext = createOptionalContext<ConversationPreferencesStateContext>(
  'ConversationPreferencesStateContext',
)
const ConversationPreferencesStateContext = optionalConversationPreferencesStateContext.Context
export const useConversationPreferencesStateContext = optionalConversationPreferencesStateContext.useOptionalContext

const ConversationPreferencesStateProvider: React.FC<WithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      isSearchOpen,
      setIsSearchOpen,
      searchQuery,
      setSearchQuery,
    }),
    [isOpen, isSearchOpen, searchQuery],
  )

  return <ConversationPreferencesStateContext value={value}>{children}</ConversationPreferencesStateContext>
}

export default ConversationPreferencesStateProvider
