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
import { ListItemButton, ListItemButtonProps, Stack, useTheme } from '@mui/material'
import { ReactNode } from 'react'

type CustomListItemButtonProps = ListItemButtonProps & {
  icon: ReactNode
  primaryText: ReactNode
  secondaryText?: ReactNode
}

// The spacings between the elements of ListItemButton have been too hard to customize in the theme,
// plus 'primary' and 'secondary' props on ListItemText do not accept block elements such as div.
// This component exists in order to keep consistency in lists nevertheless
export const CustomListItemButton = ({ icon, primaryText, secondaryText, ...props }: CustomListItemButtonProps) => {
  const theme = useTheme()
  return (
    <ListItemButton
      alignItems="center"
      sx={{
        borderRadius: '9999px',
        py: theme.Panel.itemPadding,
        pl: '6px',
        pr: '12px',
      }}
      {...props}
    >
      <Stack
        direction="row"
        spacing={theme.Panel.padding}
        sx={{
          alignItems: 'center',
          width: '100%',
        }}
      >
        {icon}
        <Stack
          sx={{
            justifyContent: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          {primaryText}
          {secondaryText}
        </Stack>
      </Stack>
    </ListItemButton>
  )
}
