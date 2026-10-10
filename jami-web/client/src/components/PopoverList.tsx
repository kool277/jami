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
import {
  alpha,
  Divider,
  ListItemText,
  ListItemTextProps,
  MenuItem,
  MenuItemProps,
  MenuList,
  MenuListProps,
  MenuProps,
  Stack,
  styled,
  SvgIconProps,
} from '@mui/material'
import { ComponentType, Fragment } from 'react'

export type PopoverListItemData = {
  label: string
  Icon: ComponentType<SvgIconProps>
  iconColor?: string
  iconSize?: string
  dividerBefore?: boolean
  destructive?: boolean
  disabled?: boolean
  onClick: () => void
}

interface ListIconProps extends SvgIconProps {
  Icon: ComponentType<SvgIconProps>
  iconColor?: string
  iconSize?: string
}

const ListIcon = styled(({ Icon, iconColor, iconSize, ...props }: ListIconProps) => <Icon {...props} />)(
  ({ iconColor, iconSize = '20px' }) => ({
    height: iconSize,
    fontSize: iconSize,
    color: iconColor ?? 'inherit',
  }),
)

interface ListLabelProps extends ListItemTextProps {
  label: string
}

const ListLabel = styled(({ label, ...props }: ListLabelProps) => (
  <ListItemText
    {...props}
    primary={label}
    slotProps={{
      primary: {
        variant: 'caption',
      },
    }}
  />
))(() => ({
  height: '16px',
}))

interface PopoverListItemProps extends MenuItemProps {
  item: PopoverListItemData
  closeMenu?: MenuProps['onClose']
}

const PopoverListItem = styled(({ item, closeMenu, ...props }: PopoverListItemProps) => (
  <MenuItem
    {...props}
    disabled={item.disabled}
    onClick={() => {
      item.onClick()
      closeMenu?.({}, 'backdropClick')
    }}
    sx={{
      paddingX: '8px',
      borderRadius: '18px',
      ...(item.destructive && {
        '&:hover, &.Mui-focusVisible': {
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.08),
          color: 'error.main',
        },
      }),
    }}
  >
    <Stack direction="row" spacing="10px" sx={{ alignItems: 'center' }}>
      <ListIcon Icon={item.Icon} iconColor={item.iconColor} iconSize={item.iconSize} />
      <ListLabel label={item.label} />
    </Stack>
  </MenuItem>
))(() => ({
  // Failed to modify the styles from here
  height: '36px',
}))

interface PopoverListProps extends MenuListProps {
  items: PopoverListItemData[]
  onClose?: MenuProps['onClose']
}

// A list intended to be used as a menu into a popover
const PopoverList = styled(({ items, onClose, ...props }: PopoverListProps) => (
  <MenuList {...props}>
    {items.map((item) => (
      <Fragment key={item.label}>
        {item.dividerBefore && <Divider sx={{ mx: 2 }} />}
        <PopoverListItem item={item} closeMenu={onClose} />
      </Fragment>
    ))}
  </MenuList>
))(() => ({
  padding: '6px 6px',
}))

export default PopoverList
