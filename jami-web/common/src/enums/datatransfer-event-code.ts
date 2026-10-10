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

export enum DataTransferEventCode {
  invalid = 0,
  created = 1,
  unsupported = 2,
  wait_peer_acceptance = 3,
  wait_host_acceptance = 4,
  ongoing = 5,
  finished = 6,
  closed_by_host = 7,
  closed_by_peer = 8,
  invalid_pathname = 9,
  unjoinable_peer = 10,
  timeout_expired = 11,
}
