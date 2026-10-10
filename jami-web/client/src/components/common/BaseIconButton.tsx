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
import IconButton, { type IconButtonProps } from '@mui/material/IconButton'
import { type TooltipProps } from '@mui/material/Tooltip'
import { useState } from 'react'

import Tooltip from '../Tooltip.js'

export type BaseIconButtonProps = Omit<IconButtonProps, 'aria-label'> & {
  'aria-label': string
  tooltip: TooltipProps['title']
}

export default function BaseIconButton({ tooltip, onClick, ...props }: BaseIconButtonProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false)

  return (
    <Tooltip
      onClose={() => setTooltipOpen(false)}
      onOpen={() => setTooltipOpen(true)}
      open={tooltipOpen}
      title={tooltip}
    >
      <span>
        <IconButton
          {...props}
          onClick={(event) => {
            setTooltipOpen(false)
            onClick?.(event)
          }}
        />
      </span>
    </Tooltip>
  )
}
