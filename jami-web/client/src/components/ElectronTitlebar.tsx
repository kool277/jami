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

import CloseIcon from '@mui/icons-material/Close'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import RemoveIcon from '@mui/icons-material/Remove'
import { Box, IconButton, Typography, useTheme } from '@mui/material'

const isMac = navigator.platform.toUpperCase().includes('MAC')

export default function ElectronTitlebar() {
  const theme = useTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '32px',
        // -webkit-app-region: drag makes the titlebar draggable in Electron
        WebkitAppRegion: 'drag',
        backgroundColor: theme.palette.primary.dark,
        color: theme.palette.primary.contrastText,
        userSelect: 'none',
        // On macOS, leave space for the native traffic light buttons
        paddingLeft: isMac ? '78px' : '12px',
        paddingRight: '0px',
        zIndex: theme.zIndex.appBar + 1,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        Jami
      </Typography>

      {/* On macOS, native traffic lights are used — no custom buttons needed */}
      {!isMac && (
        <Box sx={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
          <IconButton
            size="small"
            onClick={() => window.electronAPI?.minimize()}
            sx={{
              color: 'inherit',
              borderRadius: 0,
              width: 46,
              height: 32,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => window.electronAPI?.maximize()}
            sx={{
              color: 'inherit',
              borderRadius: 0,
              width: 46,
              height: 32,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
            }}
          >
            <CropSquareIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => window.electronAPI?.close()}
            sx={{
              color: 'inherit',
              borderRadius: 0,
              width: 46,
              height: 32,
              '&:hover': { backgroundColor: '#e81123', color: '#fff' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  )
}
