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

import { Box } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { useActionMessageReadContext } from '../contexts/ActionMessageProvider.js'
import { useGlobalSetEditMessage } from '../contexts/ActionMessageProvider.js'
import BaseIconButton from './common/BaseIconButton.js'
import { CancelIcon, PenIcon } from './SvgIcon.js'

export default function EditMessage() {
  const { editMessage } = useActionMessageReadContext()
  const setEditMessage = useGlobalSetEditMessage()
  const { t } = useTranslation()

  if (editMessage === undefined) {
    return
  }

  const onCancelEdit = () => {
    setEditMessage(undefined)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', padding: '1%' }}>
        <PenIcon sx={{ marginLeft: '2%' }} />
        <Box sx={{ marginLeft: '10%' }}>{t('editing')}</Box>
      </Box>
      <BaseIconButton
        aria-label={t('cancel_editing')}
        tooltip={t('cancel_editing')}
        sx={{ marginLeft: '5px' }}
        onClick={onCancelEdit}
      >
        <CancelIcon />
      </BaseIconButton>
    </Box>
  )
}
