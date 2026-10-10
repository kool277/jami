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
import { HttpStatusCode, IAdminConfigState } from '@savoirfairelinux/jami-web-common'
import { useQuery } from '@tanstack/react-query'
import axios, { AxiosError } from 'axios'
import { use, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { apiUrl } from '../utils/constants.js'

export const useGetAdminConfigQuery = () => {
  const navigate = useNavigate()
  const { setAlertContent } = use(AlertSnackbarContext)
  const query = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: async () => {
      const { data } = await axios.get<IAdminConfigState>('/admin/config', { baseURL: apiUrl })
      return data
    },
  })

  useEffect(() => {
    if (query.error) {
      const response = query.error as AxiosError
      if (response?.status === HttpStatusCode.Unauthorized) {
        localStorage.removeItem('adminAccessToken')
        navigate('/admin/login')
      } else {
        setAlertContent({
          messageI18nKey: 'unknown_error_alert',
          severity: 'error',
          alertOpen: true,
        })
      }
    }
  }, [query.error, navigate, setAlertContent])

  return query
}
