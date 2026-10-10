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
import { Box, Stack } from '@mui/material'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'

import JamiIdDisplay from '../../components/JamiIdDisplay.js'
import { useAuthContext } from '../../contexts/AuthProvider.js'
import { thumbnailVariants } from '../../themes/MotionVariants.js'
import LinkedDevicesPreview from './AccountSettings/LinkedDevicesPreview.js'
import { SettingsSection } from './SettingsPage.js'

export default function AccountPreferences() {
  const { t } = useTranslation()
  const { account } = useAuthContext()

  const isJamiAccount = account.getType() === 'RING'

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={{
        enter: { transition: { staggerChildren: 0.05 } },
        exit: { transition: { staggerChildren: 0.02 } },
      }}
    >
      <Stack spacing={2}>
        {isJamiAccount && (
          <motion.div variants={thumbnailVariants}>
            <SettingsSection title={t('jami_account')} list={false}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <JamiIdDisplay account={account} />
              </Box>
            </SettingsSection>
          </motion.div>
        )}

        <motion.div variants={thumbnailVariants}>
          <SettingsSection title={t('devices')} list={false}>
            <LinkedDevicesPreview />
          </SettingsSection>
        </motion.div>
      </Stack>
    </motion.div>
  )
}
