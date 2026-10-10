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
import { ConversationInfos } from '@savoirfairelinux/jami-web-common'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Account } from '../models/account.js'
import { ConversationMember } from '../models/conversation-member.js'
import { translateEnumeration, TranslateEnumerationOptions } from '../utils/translations.js'

export const useConversationDisplayName = (
  account: Account,
  conversationInfos: ConversationInfos | undefined,
  members: ConversationMember[] | undefined = [],
) => {
  const { t } = useTranslation()

  const adminTitle = conversationInfos?.title as string

  return useMemo(() => {
    if (adminTitle) {
      return adminTitle
    }

    const options: TranslateEnumerationOptions<ConversationMember> = {
      elementPartialKey: 'member',
      getElementValue: (member) => member.getDisplayName(),
      translaters: [
        () =>
          // The user is chatting with themself
          t('conversation_title_1', { member0: account?.getDisplayName() }),
        (interpolations) => t('conversation_title_1', interpolations),
        (interpolations) => t('conversation_title_2', interpolations),
        (interpolations) => t('conversation_title_3', interpolations),
        (interpolations) => t('conversation_title_4', interpolations),
        (interpolations) => t('conversation_title_more', interpolations),
      ],
    }

    return translateEnumeration<ConversationMember>(members, options)
  }, [account, adminTitle, members, t])
}

export const useConversationDisplayNameShort = (
  account: Account | null,
  title: string | undefined,
  membersNames: string[],
): string => {
  return useMemo(() => {
    if (title) {
      return title
    }

    if (membersNames.length === 0) {
      return account?.getDisplayName() || ''
    }

    const twoFirstMembers = membersNames.slice(0, 2)
    const baseName = twoFirstMembers.join(', ')
    const excess = membersNames.length - twoFirstMembers.length

    if (excess > 0) {
      return baseName + ' +' + excess
    } else {
      return baseName
    }
  }, [account, title, membersNames])
}
