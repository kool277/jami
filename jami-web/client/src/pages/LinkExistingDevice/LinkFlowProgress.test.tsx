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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import LinkFlowProgress from './LinkFlowProgress.js'

describe('LinkFlowProgress', () => {
  it('shows five dots and fills only the current step', () => {
    render(<LinkFlowProgress currentStep={3} />)

    const dots = screen.getAllByTestId('link-flow-progress-dot')

    expect(dots).toHaveLength(5)
    expect(dots[2]).toHaveAttribute('data-current', 'true')
    expect(dots.filter((dot) => dot.dataset.current === 'true')).toHaveLength(1)
  })
})
