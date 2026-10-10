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
import { Box, Stack } from '@mui/material'
import { memo, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

import ChatInterfaceManager from '../components/ChatInterfaceManager.js'
import { ConversationHeader } from '../components/ConversationView.js'
import { FileDragOverlay } from '../components/Overlay.js'
import { useActionMessageReadContext, useActionMessageWriteContext } from '../contexts/ActionMessageProvider.js'
import { FileHandler } from '../utils/files.js'

const ChatInterface = () => {
  const { setFileHandlers } = useActionMessageWriteContext()
  const { fileHandlers } = useActionMessageReadContext()

  const onFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFileHandlers = acceptedFiles.map((file) => new FileHandler(file))
      setFileHandlers([...fileHandlers, ...newFileHandlers])
    },
    [fileHandlers, setFileHandlers],
  )

  const {
    getRootProps,
    getInputProps,
    open: openFilePicker,
    isDragActive,
  } = useDropzone({
    onDrop: onFilesDrop,
    noClick: true,
    noKeyboard: true,
  })

  return (
    <Stack
      {...getRootProps()}
      sx={{
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <ConversationHeader />
      {isDragActive && <FileDragOverlay />}
      <input {...getInputProps()} />

      <Box sx={{ pt: '56px', pb: '8px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatInterfaceManager openFilePicker={openFilePicker} />
      </Box>
    </Stack>
  )
}

export default memo(ChatInterface)
