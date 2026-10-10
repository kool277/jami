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

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { languagesInfos, LanguageTag, loadLanguageAsync } from '../i18n.js'
import { SettingSelect, SettingSelectProps } from './Settings.js'
import { LanguageIcon } from './SvgIcon.js'

interface SettingLanguageProps {
  doNotDisplayLabel?: boolean
}

const SettingLanguage = ({ doNotDisplayLabel }: SettingLanguageProps) => {
  const { t, i18n } = useTranslation()

  const settingLanguageOptions = languagesInfos.map(({ tag, fullName }) => ({
    label: fullName,
    payload: tag,
  }))

  const option = useMemo(
    // TODO: Tell Typescript the result is unable to be undefined
    () => settingLanguageOptions.find((option) => option.payload === i18n.language),
    [i18n.language, settingLanguageOptions],
  )

  const onChange = useCallback<SettingSelectProps<LanguageTag>['onChange']>(
    async (newValue) => {
      if (newValue) {
        await loadLanguageAsync(newValue.payload).then(() => {
          i18n.changeLanguage(newValue.payload)
        })
      }
    },
    [i18n],
  )

  return (
    <SettingSelect
      label={doNotDisplayLabel ? '' : t('settings_language')}
      option={option}
      options={settingLanguageOptions}
      onChange={onChange}
      startAdornment={<LanguageIcon />}
    />
  )
}

export default SettingLanguage
