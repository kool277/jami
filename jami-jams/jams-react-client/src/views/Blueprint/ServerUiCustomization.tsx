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

export interface ServerUiCustomization {
  /** if the title is undefined, we show the default title */
  title?: string;
  /** if the description is undefined, we show the default description */
  description?: string;
  areTipsEnabled: boolean;

  backgroundType: "color" | "image" | "default";
  /** only defined if backgroundType !== "default" */
  backgroundColorOrUrl?: string;
  /**
   * if this field is undefined, we show the default value
   * The color is in argb format
   */
  tipBoxAndIdColor?: string;

  /**
   * if this field is undefined, we show the default value
   * The color is in argb format
   */
  mainBoxColor?: string;

  /** the route for the logo, usually starts with "/api/image/filehandler/" */
  logoUrl?: string;
  /** The logo size from 0 to 100. 100% if left undefined */
  logoSize?: number;
}
