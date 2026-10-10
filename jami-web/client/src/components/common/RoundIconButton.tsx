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
import { styled } from '@mui/material/styles'

import BaseIconButton from './BaseIconButton.js'

/**
 * An icon button drawn as an outlined circle, used where an action needs to
 * read as a discrete target rather than a bare glyph.
 */
const RoundIconButton = styled(BaseIconButton)(({ theme }) => ({
  border: `1px solid ${theme.palette.primary.main}`,
  color: theme.palette.primary.main,
  fontSize: '15px',
  '&:active': {
    color: theme.palette.common.white,
    background: theme.palette.primary.dark,
  },
  '&.MuiIconButton-sizeSmall': {
    height: '15px',
    width: '15px',
  },
  '&.MuiIconButton-sizeMedium': {
    height: '30px',
    width: '30px',
  },
  '&.MuiIconButton-sizeLarge': {
    height: '53px',
    width: '53px',
  },
}))

export default RoundIconButton
