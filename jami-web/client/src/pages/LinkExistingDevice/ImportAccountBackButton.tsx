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

import BaseIconButton from '../../components/common/BaseIconButton.js'
import { ArrowIcon } from '../../components/SvgIcon.js'

export default function ImportAccountBackButton() {
  const { t } = useTranslation()

  return (
    <BaseIconButton aria-label={t('back')} tooltip={t('back')} onClick={() => window.history.back()}>
      <ArrowIcon />
    </BaseIconButton>
  )
}
