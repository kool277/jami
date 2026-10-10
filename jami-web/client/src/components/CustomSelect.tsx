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
import { Autocomplete, Box, InputAdornment, TextField } from '@mui/material'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useAutocompleteMenuAnimation } from './common/useAutocompleteMenuAnimation.js'
export interface SelectOption<Payload> {
  label: string
  payload: Payload
}

const width = 150

export type CustomSelectProps<OptionPayload> = {
  option?: SelectOption<OptionPayload>
  options: SelectOption<OptionPayload>[]
  onChange: (newValue: SelectOption<OptionPayload> | null) => void
  size?: 'small' | 'medium'
  startAdornment?: ReactNode
}

export const CustomSelect = <OptionPayload,>({
  option,
  options,
  onChange,
  size,
  startAdornment,
}: CustomSelectProps<OptionPayload>) => {
  const { t } = useTranslation()
  const menuAnimation = useAutocompleteMenuAnimation()

  return (
    <Autocomplete
      disableClearable
      open={menuAnimation.open}
      slots={menuAnimation.slots}
      slotProps={menuAnimation.slotProps}
      options={options}
      value={option}
      getOptionLabel={(selectOption) => selectOption.label}
      isOptionEqualToValue={(selectOption, value) => selectOption.payload === value.payload}
      openOnFocus
      onOpen={menuAnimation.onOpen}
      onClose={menuAnimation.onClose}
      onInputChange={(_, value, reason) => menuAnimation.onInputChange(value, reason)}
      onChange={(_, newValue) => onChange(newValue)}
      renderOption={({ key, ...props }, selectOption) => (
        <Box key={key} component="li" {...props}>
          {selectOption.label}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={t('select_placeholder')}
          size={size}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: startAdornment && (
                <>
                  <InputAdornment position="start">{startAdornment}</InputAdornment>
                  {params.slotProps.input.startAdornment}
                </>
              ),
            },
          }}
        />
      )}
      sx={{ width, ...menuAnimation.popupIndicatorSx }}
    />
  )
}
