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
import { type SvgIconProps } from '@mui/material/SvgIcon'
import { type ComponentType } from 'react'

import BaseIconButton, { type BaseIconButtonProps } from './BaseIconButton.js'

export type ToggleIconButtonProps = Omit<BaseIconButtonProps, 'children'> & {
  pressed: boolean
  onToggle: () => void
  IconOn: ComponentType<SvgIconProps>
  IconOff: ComponentType<SvgIconProps>
}

/**
 * A two-state icon button. The state is carried by `aria-pressed` and by a
 * change of icon, so it never depends on colour alone.
 */
export default function ToggleIconButton({ pressed, onToggle, IconOn, IconOff, sx, ...props }: ToggleIconButtonProps) {
  const Icon = pressed ? IconOn : IconOff
  return (
    <BaseIconButton
      {...props}
      aria-pressed={pressed}
      sx={{ color: pressed ? 'common.white' : 'error.main', ...sx }}
      onClick={onToggle}
    >
      <Icon />
    </BaseIconButton>
  )
}
