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
import { useMemo } from 'react'
import { useLocation, useParams } from 'react-router-dom'

export type RouteParams<UrlParams = Record<string, string>, QueryParams = Record<string, string>, State = any> = {
  urlParams: UrlParams
  queryParams: QueryParams
  state?: State
}

export const useUrlParams = <T extends RouteParams>() => {
  const { search, state } = useLocation()
  const urlParams = useParams() as T['urlParams']

  return useMemo(() => {
    const queryParams = Object.fromEntries(new URLSearchParams(search)) as T['queryParams']
    return {
      queryParams,
      urlParams,
      state: state as T['state'],
    }
  }, [search, urlParams, state])
}
