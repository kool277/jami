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

import { Box, Typography } from '@mui/material'
import { DeviceAuthStateCode } from '@savoirfairelinux/jami-web-common'
import { useTranslation } from 'react-i18next'

import { FrameExclamationIcon } from '../../components/SvgIcon.js'
import UnconnectedUserLayout from '../../components/UnconnectedUserLayout.js'
import CancelLinkDeviceButton from './CancelLinkDeviceButton.js'
import LinkFlowProgress from './LinkFlowProgress.js'
import { useImportFlowGuard } from './useImportFlowGuard.js'

export default function ImportAccountConnecting() {
  const { t } = useTranslation()
  useImportFlowGuard(DeviceAuthStateCode.Connecting)

  return (
    <UnconnectedUserLayout
      pageName={t('import_account')}
      message=""
      footerAccessory={<LinkFlowProgress currentStep={2} />}
    >
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignContent: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <FrameExclamationIcon aria-hidden="true" fontSize="small" />
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ fontWeight: 'bold' }}>
                {t('action_required')}:
              </Box>{' '}
              {t('import_confirm_account')}
            </Typography>
          </Box>
          <Box sx={{ mt: 2 }}>
            <CancelLinkDeviceButton />
          </Box>
        </Box>
      </Box>
    </UnconnectedUserLayout>
  )
}
