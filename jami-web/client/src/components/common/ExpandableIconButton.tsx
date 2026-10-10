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
import {
  Box,
  FormControlLabel,
  IconButton,
  type IconButtonProps,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  type RadioGroupProps,
  type SvgIconProps,
} from '@mui/material'
import { type ComponentType, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ExpandLessIcon } from '../SvgIcon.js'

type ExpandMenuOption = {
  description: ReactNode
  icon?: ReactNode
}

export type ExpandMenuRadioOption = RadioGroupProps & {
  options: {
    key: string
    description: ReactNode
  }[]
}

export type ExpandableButtonProps = IconButtonProps & {
  isVertical?: boolean
  expandMenuOnClick?: boolean
  Icon?: ComponentType<SvgIconProps>
  expandMenuOptions?: (ExpandMenuOption | ExpandMenuRadioOption)[]
  IconButtonComp?: ComponentType<IconButtonProps>
}

export const ExpandableButton = ({
  isVertical,
  Icon,
  expandMenuOnClick,
  expandMenuOptions = undefined,
  IconButtonComp = IconButton,
  ...props
}: ExpandableButtonProps) => {
  const { t } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <>
      {expandMenuOptions && (
        <Menu
          anchorEl={anchorEl}
          open={!!anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: !isVertical ? 'top' : 'center',
            horizontal: !isVertical ? 'center' : 'left',
          }}
          transformOrigin={{
            vertical: !isVertical ? 'bottom' : 'center',
            horizontal: !isVertical ? 'center' : 'right',
          }}
        >
          {expandMenuOptions?.map((option) => {
            if ('options' in option) {
              const { options, ...radioGroupProps } = option
              return (
                <RadioGroup key={options.map((option) => option.key).join(':')} {...radioGroupProps}>
                  {options.map(({ description, key }) => (
                    <MenuItem key={key}>
                      <FormControlLabel
                        value={key}
                        control={<Radio value={key} />}
                        label={<ListItemText>{description}</ListItemText>}
                        sx={{
                          width: '100%',
                        }}
                      />
                    </MenuItem>
                  ))}
                </RadioGroup>
              )
            }

            return (
              <MenuItem key={String(option.description)} onClick={handleClose}>
                <ListItemIcon>{option.icon}</ListItemIcon>
                <ListItemText>{option.description}</ListItemText>
              </MenuItem>
            )
          })}
        </Menu>
      )}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {expandMenuOptions && (
          <IconButton
            aria-label={t('call_expand_options')}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              rotate: !isVertical ? '' : '-90deg',
              position: 'absolute',
              top: !isVertical ? '-55%' : 'auto',
              left: !isVertical ? 'auto' : '-55%',
              zIndex: 1,
            }}
            className={props.className}
          >
            <ExpandLessIcon
              fontSize="small"
              sx={{
                backgroundColor: '#444444',
                borderRadius: '50%',
              }}
            />
          </IconButton>
        )}
        <IconButtonComp
          onClick={
            expandMenuOnClick
              ? (event) => {
                  setAnchorEl(event.currentTarget)
                }
              : undefined
          }
          {...props}
        >
          {Icon && <Icon />}
        </IconButtonComp>
      </Box>
    </>
  )
}
