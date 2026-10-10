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
import { Badge, ButtonBase, type ButtonBaseProps, Tooltip, Typography } from '@mui/material'
import { type ElementType, type ReactNode, type Ref } from 'react'

export interface NavItemProps extends Omit<ButtonBaseProps, 'children'> {
  icon: ReactNode
  label: string
  badgeCount?: number
  selected?: boolean
  /** Compact is the bottom-bar form: the label sits under the icon instead of in a tooltip. */
  compact?: boolean
  component?: ElementType
  to?: string
  ref?: Ref<HTMLButtonElement>
}

/**
 * A single destination in the navigation rail. The label is never dropped: it is
 * either rendered underneath the icon or exposed through the tooltip, and it is
 * always the accessible name, so the rail stays usable without reading the icons.
 */
export default function NavItem({ icon, label, badgeCount, selected, compact, sx, ref, ...props }: NavItemProps) {
  const button = (
    <ButtonBase
      ref={ref}
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      focusRipple
      sx={[
        {
          flexDirection: 'column',
          gap: 0.25,
          flex: compact ? 1 : 'none',
          width: compact ? 'auto' : 56,
          minWidth: 56,
          py: 1,
          borderRadius: 2,
          color: selected ? 'primary.dark' : 'text.secondary',
          backgroundColor: selected ? 'primary.light' : 'transparent',
          '&:hover': { backgroundColor: selected ? 'primary.light' : 'action.hover' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...props}
    >
      <Badge badgeContent={badgeCount} color="primary" overlap="circular">
        {icon}
      </Badge>
      {compact && (
        <Typography variant="caption" noWrap sx={{ maxWidth: '100%', px: 0.5 }}>
          {label}
        </Typography>
      )}
    </ButtonBase>
  )

  if (compact) {
    return button
  }

  return (
    <Tooltip title={label} placement="right">
      {button}
    </Tooltip>
  )
}
