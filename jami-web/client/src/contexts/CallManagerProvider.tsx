/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
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
import { RemoteVideoOverlay } from '../components/VideoOverlay.js'
import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { useUrlParams } from '../hooks/useUrlParams.js'
import { ConversationRouteParams } from '../router.js'
import { ICallManager, useCallManager } from '../services/CallManager.js'
import { WithChildren } from '../utils/utils.js'

const optionalCallManagerContext = createOptionalContext<ICallManager>('CallManagerContext')
export const useCallManagerContext = optionalCallManagerContext.useOptionalContext

export default ({ children }: WithChildren) => {
  const { urlParams } = useUrlParams<ConversationRouteParams>()
  const callManager = useCallManager()

  const { callData } = callManager

  return (
    <optionalCallManagerContext.Context value={callManager}>
      {callData && callData.conversationId !== urlParams.conversationId && (
        <RemoteVideoOverlay callConversationId={callData.conversationId} />
      )}
      {children}
    </optionalCallManagerContext.Context>
  )
}
