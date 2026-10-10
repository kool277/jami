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

import { SettingSwitch } from '../../../components/Settings.js'
import { setTipsEnabled, useTipsEnabled } from '../../../utils/tips.js'

const SettingTips = ({ controlOnly = false }: { controlOnly?: boolean }) => {
  const { t } = useTranslation()
  const tipsEnabled = useTipsEnabled()

  return (
    <SettingSwitch
      controlOnly={controlOnly}
      label={t('show_tips')}
      onChange={(_, checked) => setTipsEnabled(checked)}
      checked={tipsEnabled}
    />
  )
}

export default SettingTips
