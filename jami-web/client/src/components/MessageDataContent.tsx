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
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'
import { darken } from '@mui/system'
import { useTranslation } from 'react-i18next'

import { useConversationPreferencesColorContext } from '../contexts/ConversationPreferencesColorContext.js'
import { getPeerBubbleColor, getTextColor } from '../utils/messagecolor.js'
import { useDataSizeUnits } from '../utils/units.js'
import EllipsisMiddle from './EllipsisMiddle.js'
import { AttachFileIcon } from './SvgIcon.js'

interface MessageDataContentProps {
  displayName: string
  totalSize: number
  isAccountMessage?: boolean
  isNotAvailable?: boolean
  isReply?: boolean
}

export default function ({
  displayName,
  totalSize,
  isAccountMessage,
  isNotAvailable,
  isReply,
}: MessageDataContentProps) {
  const { t } = useTranslation()
  const theme = useTheme()
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const isMedium: boolean = useMediaQuery(theme.breakpoints.down('md'))
  const { conversationColor } = useConversationPreferencesColorContext()

  const color = isAccountMessage ? conversationColor : getPeerBubbleColor(theme)
  const backgroundColor = darken(color, 0.3)
  const textColor = isAccountMessage ? getTextColor(color) : theme.palette.text.primary
  const formattedTotalSize = useDataSizeUnits(totalSize)
  return (
    <Box
      sx={{
        maxWidth: isMobile ? '210px' : isMedium ? '270px' : '300px',
        minWidth: isMobile ? '210px' : isMedium ? '270px' : '300px',
        textOverflow: 'ellipsis',
        display: 'flex',
        flexDirection: 'row',
        alignContent: 'center',
        alignItems: 'center',
        gap: '5px',
        pb: '10px',
        pt: '5px',
        pr: '3px',
        pl: '1px',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '50px',
          minHeight: '50px',
          width: '50px',
          minWidth: '50px',
          padding: 0,
          backgroundColor: backgroundColor,
          borderRadius: '12px',
          marginTop: '-7px',
          marginBottom: '-15px',
          boxSizing: 'border-box',
        }}
      >
        <AttachFileIcon sx={{ color: 'grey', fontSize: '26px' }} />
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          color: isReply ? 'text.secondary' : textColor,
          width: '70%',
        }}
      >
        <EllipsisMiddle text={displayName} />
        <Box
          sx={{
            typography: 'caption',
            whiteSpace: 'nowrap',
            marginLeft: '2px',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0px' : '4px',
          }}
        >
          {formattedTotalSize}{' '}
          {isNotAvailable && (
            <Typography
              variant="caption"
              sx={{
                fontStyle: 'italic',
                marginTop: isMobile ? '-4px' : 'unset',
                paddingBottom: isMobile ? '4px' : 'unset',
                marginLeft: isMobile ? 'unset' : '4px',
              }}
            >
              {t('ressource_not_available')}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
