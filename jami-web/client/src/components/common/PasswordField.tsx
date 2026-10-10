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
import { InputAdornment, TextField, type TextFieldProps } from '@mui/material'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CrossedEyeIcon, EyeIcon } from '../SvgIcon.js'
import BaseIconButton from './BaseIconButton.js'

export type PasswordFieldProps = Omit<TextFieldProps, 'slotProps'> & {
  startAdornment?: ReactNode
}

export default function PasswordField({
  autoComplete = 'current-password',
  startAdornment,
  ...props
}: PasswordFieldProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const label = visible ? t('password_hide') : t('password_show')

  return (
    <TextField
      {...props}
      autoComplete={autoComplete}
      type={visible ? 'text' : 'password'}
      slotProps={{
        input: {
          startAdornment: startAdornment && <InputAdornment position="start">{startAdornment}</InputAdornment>,
          endAdornment: (
            <InputAdornment position="end">
              <BaseIconButton
                aria-label={label}
                tooltip={label}
                onClick={() => setVisible((current) => !current)}
                edge="end"
              >
                {visible ? <CrossedEyeIcon /> : <EyeIcon />}
              </BaseIconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
