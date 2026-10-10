/*
 * Copyright (C) 2025 Savoir-faire Linux Inc.
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
import fs from 'fs'

export function imageToBase64(path: string) {
  try {
    const imageBuffer = fs.readFileSync(path)
    const base64Image = imageBuffer.toString('base64')
    return base64Image
  } catch (error) {
    console.error("Erreur lors de la conversion de l'image en base64:", error)
    return null
  }
}
