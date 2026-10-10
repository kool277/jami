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
import { ConversationMemberRole, IConversationMember } from '@savoirfairelinux/jami-web-common'

import { Contact } from './contact.js'

export class ConversationMember implements IConversationMember {
  readonly role
  readonly contact

  constructor(role: ConversationMemberRole | undefined, contact: Contact) {
    this.role = role
    this.contact = contact
  }

  static fromInterface(conversationMemberIterface: IConversationMember) {
    return new ConversationMember(
      conversationMemberIterface.role,
      Contact.fromInterface(conversationMemberIterface.contact),
    )
  }

  getDisplayName = () => {
    return this.contact.getDisplayName()
  }
}
