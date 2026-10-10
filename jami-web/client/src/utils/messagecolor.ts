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
import { darken, lighten, Theme } from '@mui/material/styles'
import CryptoJS from 'crypto-js'

// do not modify the order of the colors
export const colors = [
  '#f44336',
  '#e91e63',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#2196f3',
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#8BC34A',
  '#CDDC39',
  '#FFC107',
  '#FF5722',
  '#795548',
  '#9E9E9E',
  '#607D8B',
]

export const messageColors = [
  '#C2185B',
  '#5934AE',
  '#303F9F',
  '#005699',
  '#0288D1',
  '#0097A7',
  '#00796B',
  '#689F30',
  '#9E9D24',
  '#FDD835',
  '#FA2E30',
  '#A6948B',
  '#6C6C6C',
]

// colors of bubble and text inside the bubble does not
// change based dark mode or light mode
const darkColorsText = ['#fdd835']
const darkColorsTime = ['#c2185b', '#0288d1', '#0097a7', '#689f30', '#9e9d24', '#fa2e30', '#a6948b']

export function getTextColor(color: string): string {
  if (darkColorsText.includes(color)) {
    return '#7F7F7F'
  }
  return '#FFFFFF'
}

export function getSentTimeColor(color: string): string {
  if (darkColorsTime.includes(color)) {
    return '#cfcfcf'
  }
  return '#A6948B'
}

// A reply bubble is nested inside its parent, so it is ringed in the surface behind it to read as
// a separate card. The width is fixed: a mode-dependent width would resize the bubble on theme
// change and shift the whole thread.
export function getReplyRing(theme: Theme): string {
  return `2px solid ${theme.palette.background.default}`
}

// Message bubbles sit over the app surface. Deriving their tones from that surface means a palette
// change cannot leave a stale, unrelated chat colour behind.
export function getPeerBubbleColor(theme: Theme): string {
  return theme.palette.mode === 'light'
    ? darken(theme.palette.background.paper, 0.04)
    : lighten(theme.palette.background.paper, 0.36)
}

export function getReplyBubbleColor(theme: Theme): string {
  return theme.palette.mode === 'light'
    ? darken(theme.palette.background.paper, 0.07)
    : lighten(theme.palette.background.paper, 0.17)
}

export function getColor(canonicalUri: string): string {
  if (canonicalUri === '') {
    return '#9E9E9E' // default color
  }
  const hash: string = CryptoJS.MD5(canonicalUri).toString()
  if (hash === '') {
    return '#9E9E9E'
  }
  const colorIndex = parseInt(hash.charAt(0) + '', 16)
  return colors[colorIndex % colors.length]
}
