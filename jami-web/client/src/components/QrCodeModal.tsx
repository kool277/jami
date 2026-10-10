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
import { useTranslation } from 'react-i18next'

import { Account } from '../models/account.js'
import BaseModalDialog from './common/BaseModalDialog.js'
import JamiQrCode from './JamiQrCode.js'

interface QrCodeModalProps {
  account: Account
  open: boolean
  onClose: () => void
}

const QrCodeModal = ({ account, open, onClose }: QrCodeModalProps) => {
  const { t } = useTranslation()
  const qrCodeSize: number = 250

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      aria-label={t('contact_details_qr_code')}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      contentSx={{ margin: '0px' }}
    >
      <JamiQrCode size={qrCodeSize} value={account.getUri()} />
    </BaseModalDialog>
  )
}

export default QrCodeModal
