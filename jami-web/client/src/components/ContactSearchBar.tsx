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

import { Box, InputBase, Stack } from '@mui/material'

import { SearchRoundedIcon as SearchRounded } from './SvgIcon.js'

interface ContactSearchBarProps {
  placeholder: string
  value: string
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

// TODO: restore the "open contacts" button here once the contacts page is implemented.
export default function ContactSearchBar({ placeholder, value, handleChange }: ContactSearchBarProps) {
  return (
    <Stack direction="row" sx={{ flexShrink: 0 }}>
      <Box
        data-testid="contact-search-bar"
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: '9999px',
          backgroundColor: 'background.default',
          height: 40,
          flex: 1,
        }}
      >
        <InputBase
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          startAdornment={
            <SearchRounded
              sx={{
                color: 'grey.500',
                ml: 1,
                mr: 0.5,
              }}
            />
          }
          sx={{
            flexGrow: 1,
            '& .MuiInputBase-input::placeholder': { color: 'text.secondary', opacity: 1 },
            color: 'text.primary',
          }}
        />
      </Box>
    </Stack>
  )
}
