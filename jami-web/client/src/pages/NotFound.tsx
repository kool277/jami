/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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
import { Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import BaseButton from '../components/common/BaseButton.js'
import EmptyState from '../components/common/EmptyState.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'

export default function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useDocumentTitle(t('page_not_found'))

  return (
    <Stack sx={{ height: '100dvh', alignItems: 'center', justifyContent: 'center' }}>
      <EmptyState
        title={t('page_not_found')}
        description={t('page_not_found_description')}
        action={
          <BaseButton variant="contained" onClick={() => navigate('/conversation')}>
            {t('back_to_conversations')}
          </BaseButton>
        }
      />
    </Stack>
  )
}
