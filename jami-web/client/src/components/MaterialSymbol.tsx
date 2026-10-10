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
import { Icon, type IconProps, useTheme } from '@mui/material'

export interface MaterialSymbolProps extends IconProps {
  symbol: string
  filled?: boolean
  weight?: number
  bidirectional?: boolean
}

/**
 * Renders a Material Symbols Outlined icon with weight 300.
 */
const MaterialSymbol = ({ symbol, filled, weight = 300, bidirectional = false, sx, ...props }: MaterialSymbolProps) => {
  const theme = useTheme()

  return (
    <Icon
      baseClassName="material-symbols-outlined"
      {...props}
      sx={[
        {
          fontVariationSettings: `'wght' ${weight}${filled ? ", 'FILL' 1" : ''}`,
        },
        ...(Array.isArray(sx) ? sx : sx === undefined ? [] : [sx]),
      ]}
    >
      <span
        style={
          bidirectional && theme.direction === 'rtl' ? { display: 'inline-block', transform: 'scaleX(-1)' } : undefined
        }
      >
        {symbol}
      </span>
    </Icon>
  )
}

export default MaterialSymbol
