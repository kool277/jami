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
import { Box } from '@mui/material'

const LINK_FLOW_STEP_COUNT = 5

interface LinkFlowProgressProps {
  currentStep: number
}

/**
 * A visual orientation aid only: the surrounding screen title and instructions convey the current
 * step to assistive technology, so the dots are kept out of the accessibility tree.
 */
export default function LinkFlowProgress({ currentStep }: LinkFlowProgressProps) {
  return (
    <Box component="span" aria-hidden="true" sx={{ display: 'inline-flex', gap: 1 }}>
      {Array.from({ length: LINK_FLOW_STEP_COUNT }, (_, index) => {
        const step = index + 1
        const isCurrent = step === currentStep

        return (
          <Box
            component="span"
            key={step}
            data-current={isCurrent || undefined}
            data-testid="link-flow-progress-dot"
            id={`link-flow-progress-dot-${step}`}
            sx={{
              width: 8,
              height: 8,
              border: 1,
              borderColor: 'primary.main',
              borderRadius: '50%',
              bgcolor: isCurrent ? 'primary.main' : 'transparent',
            }}
          />
        )
      })}
    </Box>
  )
}
