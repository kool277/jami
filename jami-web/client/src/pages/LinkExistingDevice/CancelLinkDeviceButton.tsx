/*
 * Copyright (C) 2026 Savoir-faire Linux Inc.
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

import BaseButton from '../../components/common/BaseButton.js'
import { useImportDeviceContext } from '../../contexts/ImportDeviceProvider.js'
import { useCancelLinkDeviceMutation } from '../../services/authQueries.js'

/**
 * Way out of the waiting steps: the daemon may never report the next state, and the user would
 * otherwise be left on a screen without any control.
 */
export default function CancelLinkDeviceButton() {
  const { t } = useTranslation()
  const { accountId } = useImportDeviceContext()
  const cancelLinkDeviceMutation = useCancelLinkDeviceMutation()

  return (
    <BaseButton
      variant="outlined"
      disabled={cancelLinkDeviceMutation.isPending}
      onClick={() => cancelLinkDeviceMutation.mutate(accountId)}
    >
      {t('dialog_cancel')}
    </BaseButton>
  )
}
