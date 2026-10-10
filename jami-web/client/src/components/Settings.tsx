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
import { FormLabel, List, ListItem, ListSubheader, Stack, Switch, SwitchProps } from '@mui/material'
import { Box } from '@mui/system'
import { MouseEventHandler, ReactElement } from 'react'

import BaseButton from './common/BaseButton.js'
import { CustomSelect, CustomSelectProps } from './CustomSelect.js'

interface Setting {
  label: string
}

interface SettingBaseProps {
  label: string
  children: ReactElement
}

const SettingBase = ({ label, children }: SettingBaseProps) => {
  return (
    <ListItem sx={{ padding: 0, margin: 0 }}>
      <FormLabel sx={{ width: '100%' }}>
        <Stack direction="row">
          <Box
            sx={{
              flexGrow: 1,
            }}
          >
            {label}
          </Box>
          {children}
        </Stack>
      </FormLabel>
    </ListItem>
  )
}

interface SettingButtonProps extends Setting {
  onClick: MouseEventHandler
}

export const SettingButton = ({ onClick, ...settingBaseProps }: SettingButtonProps) => {
  return (
    <SettingBase {...settingBaseProps}>
      <BaseButton variant="contained" size="small" onClick={onClick} />
    </SettingBase>
  )
}

export interface SettingSelectProps<OptionPayload> extends Setting, CustomSelectProps<OptionPayload> {}

export const SettingSelect = <OptionPayload,>({
  options,
  option,
  onChange,
  startAdornment,
  ...settingBaseProps
}: SettingSelectProps<OptionPayload>) => {
  return (
    <SettingBase {...settingBaseProps}>
      <CustomSelect<OptionPayload>
        option={option}
        options={options}
        onChange={onChange}
        size="small"
        startAdornment={startAdornment}
      />
    </SettingBase>
  )
}

interface SettingSwitchProps extends Setting {
  checked: SwitchProps['checked']
  onChange: SwitchProps['onChange']
  controlOnly?: boolean
}

export const SettingSwitch = ({ checked, onChange, controlOnly, ...settingBaseProps }: SettingSwitchProps) => {
  if (controlOnly) {
    return (
      <Switch checked={checked} onChange={onChange} slotProps={{ input: { 'aria-label': settingBaseProps.label } }} />
    )
  }

  return (
    <SettingBase {...settingBaseProps}>
      <Switch checked={checked} onChange={onChange} />
    </SettingBase>
  )
}

interface SettingGroupProps {
  label: string
  children: ReactElement[] | ReactElement
}

export const SettingsGroup = ({ label, children }: SettingGroupProps) => {
  return (
    <List
      sx={{ minWidth: '250px' }}
      subheader={
        <ListSubheader sx={{ paddingLeft: 0, backgroundColor: 'inherit', typography: 'h3' }}>{label}</ListSubheader>
      }
    >
      {children}
    </List>
  )
}
