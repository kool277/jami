/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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

import { Stack } from '@mui/material'

import { useActionMessageReadContext, useActionMessageWriteContext } from '../contexts/ActionMessageProvider.js'
import { useConversationPreferencesColorContext } from '../contexts/ConversationPreferencesColorContext.js'
import { FilePreviewRemovable } from './FilePreview.js'

const FilePreviewsList = () => {
  const { setFileHandlers } = useActionMessageWriteContext()
  const { fileHandlers } = useActionMessageReadContext()
  const { conversationColor } = useConversationPreferencesColorContext()

  const removeFile = (fileId: string | number) => {
    setFileHandlers(fileHandlers.filter((fileHandler) => fileHandler.id !== fileId))
  }

  if (fileHandlers.length === 0) {
    return
  }

  return (
    <Stack
      direction="row"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        overflow: 'auto',
        maxHeight: '30%',
        paddingX: '16px',
        marginBottom: '5px',
        paddingTop: '3px',
      }}
    >
      {fileHandlers.map((fileHandler) => (
        <FilePreviewRemovable
          key={fileHandler.id}
          remove={() => removeFile(fileHandler.id)}
          fileHandler={fileHandler}
          borderColor={conversationColor /* Should be same color as message bubble */}
        />
      ))}
    </Stack>
  )
}

export default FilePreviewsList
