/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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

import { keyframes } from '@emotion/react'
import { Box, Typography } from '@mui/material'
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import { useTranslation } from 'react-i18next'

import MaterialSymbol from '../../components/MaterialSymbol.js'
import UnconnectedUserLayout from '../../components/UnconnectedUserLayout.js'
import CancelLinkDeviceButton from './CancelLinkDeviceButton.js'
import LinkFlowProgress from './LinkFlowProgress.js'
import { useImportFlowGuard } from './useImportFlowGuard.js'

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`

export default function ImportAccountTransferInProgress() {
  const { t } = useTranslation()
  useImportFlowGuard(DeviceAuthStateCode.InProgress)

  return (
    <UnconnectedUserLayout pageName={t('import_account')} footerAccessory={<LinkFlowProgress currentStep={4} />}>
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center',
            alignContent: 'center',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MaterialSymbol
              aria-hidden="true"
              symbol="progress_activity"
              sx={{
                animation: `${spin} 1.5s linear infinite`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }}
            />
            <Typography variant="body2">{t('import_account_in_progress')}</Typography>
          </Box>
          <CancelLinkDeviceButton />
        </Box>
      </Box>
    </UnconnectedUserLayout>
  )
}
