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

import Box from '@mui/material/Box'

import { isJamiHash } from './ContactIdentity.js'

interface EllipsisMiddleProps {
  text: string
  centerItem?: boolean
  padding?: string
}
const EllipsisMiddle = ({ text, centerItem, padding }: EllipsisMiddleProps) => {
  if (!text) {
    console.error('text is undefined')
    return
  }

  if (text.length < 12) {
    return <span style={{ padding: padding, fontFamily: isJamiHash(text) ? 'monospace' : undefined }}>{text}</span>
  }

  const startFixedChars = 5
  const endFixedChars = 3

  const startWidth = startFixedChars + 2
  const endWidth = endFixedChars + 2

  const firstPart = text.slice(0, -8)
  const lastPart = text.slice(-8)

  const stylesCommon = {
    display: 'inline-block',
    verticalAlign: 'bottom',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    height: 'inherit',
    flex: '0 1 auto',
  }

  return (
    <Box
      sx={{
        textWrap: 'nowrap',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        fontFamily: isJamiHash(text) ? 'monospace' : undefined,
        display: centerItem ? 'flex' : 'unset',
        justifyContent: centerItem ? 'center' : 'unset',
      }}
    >
      <span
        style={{
          ...stylesCommon,
          maxWidth: `calc(100% - ${endWidth}em)`,
          minWidth: startWidth,
          textOverflow: 'ellipsis',
        }}
      >
        {firstPart}
      </span>
      <span style={{ ...stylesCommon, maxWidth: `calc(100% - ${startWidth}em)`, direction: 'rtl' }}>{lastPart}</span>
    </Box>
  )
}

export default EllipsisMiddle
