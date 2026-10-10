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
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  type PaletteMode,
  Paper,
  type PaperProps,
  Select,
  Stack,
  Switch,
} from '@mui/material'
import { type Direction } from '@mui/material/styles'
import { type ComponentType, type ReactElement, type RefObject, useRef } from 'react'
import * as DraggableModule from 'react-draggable'
import { useTranslation } from 'react-i18next'

import { languagesInfos, loadLanguageAsync } from '../i18n.js'

const Draggable = DraggableModule.default as unknown as ComponentType<{
  cancel?: string
  children: ReactElement
  handle?: string
  nodeRef?: RefObject<HTMLElement | null>
}>

const DraggableDialogPaper = (props: PaperProps) => {
  const paperRef = useRef<HTMLDivElement>(null)

  return (
    <Draggable cancel=".debug-tools-control" handle="#debug-tools-title" nodeRef={paperRef}>
      <Paper ref={paperRef} {...props} />
    </Draggable>
  )
}

interface DebugToolsDialogProps {
  direction: Direction
  mode: PaletteMode
  onDirectionChange: (direction: Direction | null) => void
  onModeToggle: () => void
  onReset: () => void
}

export default function DebugToolsDialog({
  direction,
  mode,
  onDirectionChange,
  onModeToggle,
  onReset,
}: DebugToolsDialogProps) {
  const { i18n } = useTranslation()

  return (
    <Dialog
      aria-labelledby="debug-tools-title"
      dir="ltr"
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      hideBackdrop
      open
      PaperComponent={DraggableDialogPaper}
      slotProps={{
        paper: {
          sx: {
            direction: 'ltr',
            margin: 1,
            overflow: 'hidden',
            pointerEvents: 'auto',
            width: 240,
          },
        },
        root: {
          sx: {
            direction: 'ltr',
            pointerEvents: 'none',
            zIndex: (theme) => theme.zIndex.tooltip + 1,
            '& .MuiDialog-container': {
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
            },
          },
        },
      }}
    >
      <DialogTitle id="debug-tools-title" sx={{ cursor: 'move', userSelect: 'none' }}>
        Debug tools
      </DialogTitle>
      <DialogContent
        className="debug-tools-control"
        sx={{
          boxSizing: 'border-box',
          cursor: 'default',
          minWidth: 0,
          overflowWrap: 'anywhere',
          overflowX: 'hidden',
          p: 0,
          '& > *': { boxSizing: 'border-box', maxWidth: '100%', minWidth: 0 },
        }}
      >
        <Stack spacing={1.5} sx={{ px: 1.5, py: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={direction === 'rtl'}
                onChange={(_, checked) => onDirectionChange(checked ? 'rtl' : 'ltr')}
              />
            }
            label="RTL"
          />
          <FormControlLabel control={<Switch checked={mode === 'dark'} onChange={onModeToggle} />} label="Dark mode" />
          <FormControl fullWidth size="small">
            <InputLabel id="debug-language-label">Language</InputLabel>
            <Select
              label="Language"
              labelId="debug-language-label"
              onChange={async (event) => {
                onDirectionChange(null)
                await loadLanguageAsync(event.target.value)
                await i18n.changeLanguage(event.target.value)
              }}
              value={i18n.language}
            >
              {languagesInfos.map(({ tag, fullName }) => (
                <MenuItem key={tag} value={tag}>
                  {fullName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ boxSizing: 'border-box', width: '100%', '& > .MuiButton-root': { flex: 1 } }}>
        <Button onClick={onReset}>Reset</Button>
      </DialogActions>
    </Dialog>
  )
}
