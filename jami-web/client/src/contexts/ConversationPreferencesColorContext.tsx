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
import { useMemo } from 'react'

import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { useConversationPreferencesQuery } from '../services/conversationQueries.js'
import { getColor } from '../utils/messagecolor.js'
import { WithChildren } from '../utils/utils.js'
import { useConversationContext } from './ConversationProvider.js'

interface ConversationPreferencesColorContext {
  conversationColor: string
}

const optionalConversationPreferencesColorContext = createOptionalContext<ConversationPreferencesColorContext>(
  'ConversationPreferencesColorContext',
)
const ConversationPreferencesColorContext = optionalConversationPreferencesColorContext.Context
export const useConversationPreferencesColorContext = optionalConversationPreferencesColorContext.useOptionalContext

const ConversationPreferencesColorProvider: React.FC<WithChildren> = ({ children }) => {
  const { conversationId } = useConversationContext()
  const preferencesQuery = useConversationPreferencesQuery(conversationId)

  const conversationColor = preferencesQuery.data?.color || getColor(conversationId)

  const value = useMemo(
    () => ({
      conversationColor,
    }),
    [conversationColor],
  )

  return <ConversationPreferencesColorContext value={value}>{children}</ConversationPreferencesColorContext>
}

export default ConversationPreferencesColorProvider
