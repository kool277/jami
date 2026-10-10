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

import { use, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import LoadingPage from '../../components/Loading.js'
import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { isElectronMode } from '../../utils/electron.js'
import { checkAdminTokenValidity } from '../services/adminQueries.js'

interface AdminAuthWrapperProps {
  children: React.ReactNode
}

export default function AdminAuthWrapper({ children }: AdminAuthWrapperProps) {
  const { setAlertContent } = use(AlertSnackbarContext)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(() => !isElectronMode())

  useEffect(() => {
    // In Electron mode, admin auth is bypassed
    if (isElectronMode()) {
      return
    }

    if (!localStorage.getItem('adminAccessToken')) {
      navigate('/admin/login')
      return
    }

    let active = true
    void checkAdminTokenValidity().then((isValid) => {
      if (!active) {
        return
      }

      setLoading(false)
      if (!isValid) {
        localStorage.removeItem('adminAccessToken')
        setAlertContent({
          messageI18nKey: 'unauthorized_access',
          severity: 'error',
          alertOpen: true,
        })
        navigate('/admin/login')
      }
    })

    return () => {
      active = false
    }
  }, [navigate, setAlertContent])

  if (loading) {
    return <LoadingPage />
  }

  // only returns the children
  return <>{children}</>
}
