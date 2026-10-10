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
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import { Box, Card, CardContent, CardHeader, Container, Typography, useMediaQuery, useTheme } from '@mui/material'
import { motion } from 'framer-motion'
import { use } from 'react'
import { useTranslation } from 'react-i18next'

import { CustomThemeContext } from '../contexts/CustomThemeProvider.js'
import BaseIconButton from './common/BaseIconButton.js'
import SettingLanguage from './SettingLanguage.js'

interface UnconnectedUserLayoutProps {
  pageName?: string
  children: React.ReactNode
  message?: string
  centerMessage?: boolean
  headerAccessory?: React.ReactNode
  footerAccessory?: React.ReactNode
  /** Widen the card for content that cannot be wrapped, such as a code meant to be read out. */
  cardWidth?: string
  showAppearanceControls?: boolean
}

export default function UnconnectedUserLayout({
  pageName,
  children,
  message,
  centerMessage = false,
  headerAccessory,
  footerAccessory,
  cardWidth = '450px',
  showAppearanceControls = false,
}: UnconnectedUserLayoutProps) {
  const theme = useTheme()
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))
  const { t } = useTranslation()
  const { mode, toggleMode } = use(CustomThemeContext)

  const mainContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  }

  const cardStyle = {
    width: isMobile ? '100vw' : cardWidth,
    maxWidth: '100vw',
    padding: isMobile ? '8px' : '16px 24px',
    marginTop: isMobile ? '0' : '-5%',
    overflowY: 'auto',
    borderRadius: isMobile ? '0' : '24px',
    position: 'relative',
  }

  const isDark = theme.palette.mode === 'dark'
  const bgImage = isDark ? './admin/background_dark.jpg' : './admin/background.jpg'

  const backgroundStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    backgroundImage: `url(${bgImage})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    transition: 'background-image 0.5s ease-in-out',
  }

  return (
    <Box sx={backgroundStyle}>
      <Container className="message-list" sx={mainContainerStyle}>
        <motion.div
          initial={{ y: isMobile ? 0 : -15, opacity: isMobile ? 1 : 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card sx={cardStyle}>
            {headerAccessory && <Box sx={{ position: 'absolute', top: 8, left: 8 }}>{headerAccessory}</Box>}
            <CardHeader
              title={pageName}
              slotProps={{ title: { variant: 'h3', align: 'center' } }}
              sx={{ pb: 0, '& .MuiCardHeader-content': { flex: 1 } }}
            />
            <CardContent
              sx={
                isMobile
                  ? {
                      pt: 0,
                      width: '100%',
                      height: '90%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    }
                  : { pt: 0 }
              }
              component="div"
            >
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Typography
                  variant="body2"
                  sx={{
                    width: '100%',
                    textAlign: centerMessage ? 'center' : 'start',
                  }}
                >
                  {message}
                </Typography>
              </Box>
              <Box
                sx={
                  isMobile
                    ? {
                        height: '80%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }
                    : {}
                }
              >
                {children}
              </Box>
            </CardContent>
            {footerAccessory && (
              <Box sx={{ display: 'flex', justifyContent: 'center', px: 2, pb: 2 }}>{footerAccessory}</Box>
            )}
            {showAppearanceControls && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 2,
                  mx: isMobile ? -1 : -2,
                  mb: -1,
                }}
              >
                <Box sx={{ transform: 'translateY(4px)' }}>
                  <BaseIconButton
                    aria-label={t('settings_dark_theme')}
                    tooltip={t('settings_dark_theme')}
                    aria-pressed={mode === 'dark'}
                    onClick={toggleMode}
                  >
                    {mode === 'dark' ? <LightMode /> : <DarkMode />}
                  </BaseIconButton>
                </Box>
                <Box sx={{ transform: 'translateY(8px)' }}>
                  <SettingLanguage doNotDisplayLabel />
                </Box>
              </Box>
            )}
          </Card>
        </motion.div>
      </Container>
    </Box>
  )
}
