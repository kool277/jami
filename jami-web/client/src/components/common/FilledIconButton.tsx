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
import { type PaletteColor, styled, type Theme } from '@mui/material/styles'

import BaseIconButton from './BaseIconButton.js'

/**
 * A filled circular icon button, used for the decisive action of a screen
 * such as answering or declining a call.
 *
 * The fill is taken from a palette colour so the label always sits on the
 * contrast text the palette defines for it.
 */
const FilledIconButton = styled(BaseIconButton, {
  shouldForwardProp: (prop) => prop !== 'paletteColor',
})<{ paletteColor?: PaletteColor | ((theme: Theme) => PaletteColor) }>(({
  theme,
  paletteColor = theme.palette.primary,
}) => {
  const color = typeof paletteColor === 'function' ? paletteColor(theme) : paletteColor

  return {
    color: color.contrastText,
    backgroundColor: color.dark,
    '&:hover': {
      backgroundColor: color.main,
    },
    '&.Mui-disabled': {
      backgroundColor: theme.palette.action.disabled,
    },
  }
})

export default FilledIconButton
