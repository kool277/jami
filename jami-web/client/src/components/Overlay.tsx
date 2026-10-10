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
import { styled } from '@mui/material'

const OverlayBase = styled('div')({
  position: 'absolute',
  width: '100%',
  height: '100%',
  zIndex: 100,
})

export const FileDragOverlay = styled(OverlayBase)({
  backgroundColor: 'black',
  opacity: '30%',
})

type CircleMaskOverlayProps = {
  // Size in pixels or percentage. The percentage is relative to the length of the diagonal of the box
  size: string
}

export const CircleMaskOverlay = styled(OverlayBase)<CircleMaskOverlayProps>(({ size }) => ({
  backgroundImage: `radial-gradient(circle at center, rgba(0, 0, 0, 0) ${size}, rgba(0, 0, 0, 0.5) ${size})`,
}))
