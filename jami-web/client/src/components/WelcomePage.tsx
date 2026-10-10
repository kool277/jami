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

import { Box } from '@mui/material'
import { use, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { CustomThemeContext } from '../contexts/CustomThemeProvider.js'
import JamiLogo from '../icons/logo-jami-net.svg?react'
import JamiLogoWhite from '../icons/logo-jami-net-white.svg?react'
import AboutJamiDialog from './AboutJamiDialog.js'
import BaseButton from './common/BaseButton.js'
import JamiIdDisplay from './JamiIdDisplay.js'
import { InfoIcon } from './SvgIcon.js'
import TipsDialog from './TipsDialog.js'

export default function WelcomePage() {
  const { t } = useTranslation()
  const { account } = useAuthContext()
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const { mode } = use(CustomThemeContext)
  const isDark = mode === 'dark'

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        alignItems: 'center',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          width: '80%',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        {isDark ? (
          <JamiLogoWhite style={{ width: 'auto', height: 80 }} />
        ) : (
          <JamiLogo style={{ width: 'auto', height: 80 }} />
        )}
        <JamiIdDisplay account={account} />
      </Box>

      <BaseButton
        variant="text"
        startIcon={<InfoIcon />}
        sx={{ marginBottom: '16px' }}
        onClick={() => setIsAboutOpen(true)}
      >
        {t('about_jami')}
      </BaseButton>
      <TipsDialog />
      <AboutJamiDialog open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </Box>
  )
}
