/*
 * Copyright (C) 2022-2026 Savoir-faire Linux Inc.
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

// Re-export everything from jami-core — single source of truth for SWIG types
export {
  type Blob,
  type Constructable,
  type JamiSwig,
  loadNativeModule,
  type StringMap,
  stringMapToRecord,
  type StringVect,
  stringVectToArray,
  type VectMap,
  vectMapToRecordArray,
} from '@savoirfairelinux/jami-core'
