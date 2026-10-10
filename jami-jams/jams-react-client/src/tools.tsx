/*
 * Copyright (C) 2020-2024 by Savoir-faire Linux
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import MenuItem from "@mui/material/MenuItem";

export function buildSelectMenuItems(
  elements: {
    value: number;
    label: string;
  }[],
) {
  return elements.map((d) => (
    <MenuItem key={d.value} value={d.value}>
      {d.label}
    </MenuItem>
  ));
}

export function retrieveArrayElement(
  value: number,
  elements: {
    value: number;
    label: string;
  }[],
) {
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].value === value) {
      return elements[i];
    }
  }
}

export default { buildSelectMenuItems, retrieveArrayElement };
