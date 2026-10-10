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

import { Box, Card, CardHeader, Typography, useMediaQuery, useTheme } from '@mui/material'

interface LayoutSettingsProps {
  children: React.ReactNode
  title: string
  text?: string
  disableMarginTop?: boolean
}

export default function LayoutSettings({ children, title, text, disableMarginTop }: LayoutSettingsProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        minHeight: '420px',
        maxHeight: '600px',
        justifyContent: 'center',
        marginTop: isMobile ? '0px' : '80px',
        marginBottom: '50px',
      }}
    >
      <Card
        sx={{
          maxWidth: '400px',
          padding: '20px',
          boxShadow: isMobile ? 'none' : undefined,
          border: isMobile ? 'none' : undefined,
          backgroundColor: isMobile ? theme.palette.background.default : undefined,
          mb: '1px',
        }}
      >
        <CardHeader
          title={<Typography variant="h5">{title}</Typography>}
          subheader={
            <Box sx={{ mt: disableMarginTop ? '0px' : '40px' }}>
              <Typography variant="body2">{text}</Typography>
            </Box>
          }
        />
        <Box
          sx={{
            marginTop: disableMarginTop ? '0px' : '50px',
            maxWidth: '100%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ maxWidth: '90%' }}>{children}</Box>
        </Box>
      </Card>
    </Box>
  )
}
