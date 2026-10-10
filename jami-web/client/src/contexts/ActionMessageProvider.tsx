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
import { Message } from '@savoirfairelinux/jami-web-common'
import React, { createContext, use, useMemo, useState } from 'react'

import { FileHandler } from '../utils/files.js'
import { WithChildren } from '../utils/utils.js'

interface IActionMessageReadContext {
  editMessage: Message | undefined
  replyMessage: Message | undefined
  fileHandlers: FileHandler[]
}

interface IActionMessageWriteContext {
  setEditMessage: (value: Message | undefined) => void
  setReplyMessage: (value: Message | undefined) => void
  setFileHandlers: (fileHandlers: FileHandler[]) => void
}

const ActionMessageReadContext = createContext<IActionMessageReadContext | undefined>(undefined)
const ActionMessageWriteContext = createContext<IActionMessageWriteContext | undefined>(undefined)

export const useActionMessageReadContext = () => {
  const context = use(ActionMessageReadContext)
  if (!context) {
    throw new Error('useActionMessageReadContext must be used within an ActionMessageProvider')
  }
  return context
}

export const useActionMessageWriteContext = () => {
  const context = use(ActionMessageWriteContext)
  if (!context) {
    throw new Error('useActionMessageWriteContext must be used within an ActionMessageProvider')
  }
  return context
}

const ActionMessageProvider: React.FC<WithChildren> = ({ children }) => {
  const [editMessage, setEditMessage] = useState<Message | undefined>(undefined)
  const [replyMessage, setReplyMessage] = useState<Message | undefined>(undefined)
  const [fileHandlers, setFileHandlers] = useState<FileHandler[]>([])

  const writeContextValue = useMemo<IActionMessageWriteContext>(
    () => ({
      setEditMessage: (value: Message | undefined) => {
        setEditMessage(value)
        setReplyMessage(undefined)
      },
      setReplyMessage: (value: Message | undefined) => {
        setReplyMessage(value)
        setEditMessage(undefined)
      },
      setFileHandlers,
    }),
    [setFileHandlers],
  )

  const readContextValue = useMemo<IActionMessageReadContext>(
    () => ({
      editMessage,
      replyMessage,
      fileHandlers,
    }),
    [editMessage, replyMessage, fileHandlers],
  )

  return (
    <ActionMessageWriteContext value={writeContextValue}>
      <ActionMessageReadContext value={readContextValue}>{children}</ActionMessageReadContext>
    </ActionMessageWriteContext>
  )
}

export default ActionMessageProvider

export const useGlobalSetEditMessage = () => {
  const { setEditMessage } = useActionMessageWriteContext()
  return setEditMessage
}

export const useGlobalSetReplyMessage = () => {
  const { setReplyMessage } = useActionMessageWriteContext()
  return setReplyMessage
}
