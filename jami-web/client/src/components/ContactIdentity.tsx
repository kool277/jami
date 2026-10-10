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
import { Stack, type StackProps, Typography, type TypographyProps } from '@mui/material'

export interface ContactIdentityData {
  uri: string
  displayName?: string
  registeredName?: string
}

export const isJamiHash = (value: string) => /^[\da-f]{40}$/i.test(value)

export function IdentifierText({ children, sx, ...props }: TypographyProps) {
  const value = typeof children === 'string' ? children : ''

  return (
    <Typography
      {...props}
      sx={[{ fontFamily: isJamiHash(value) ? 'monospace' : undefined }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {children}
    </Typography>
  )
}

interface ContactIdentityProps extends ContactIdentityData, Omit<StackProps, 'children'> {
  primaryVariant?: TypographyProps['variant']
  secondaryVariant?: TypographyProps['variant']
}

export function ContactIdentity({
  uri,
  displayName,
  registeredName,
  primaryVariant = 'body1',
  secondaryVariant = 'body2',
  ...props
}: ContactIdentityProps) {
  const primaryName = displayName || registeredName || uri
  const secondaryName = displayName && registeredName && displayName !== registeredName ? registeredName : undefined

  return (
    <Stack {...props} sx={[{ minWidth: 0, gap: 0.25 }, ...(Array.isArray(props.sx) ? props.sx : [props.sx])]}>
      <IdentifierText noWrap variant={primaryVariant}>
        {primaryName}
      </IdentifierText>
      {secondaryName && (
        <IdentifierText noWrap color="text.secondary" variant={secondaryVariant}>
          {secondaryName}
        </IdentifierText>
      )}
    </Stack>
  )
}
