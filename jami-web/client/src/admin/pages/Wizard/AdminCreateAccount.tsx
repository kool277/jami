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
import { Box, Fab, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import { FormEvent, use, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupAddRoundedIcon as GroupAddRounded } from '../../../components/SvgIcon.js'
import UnconnectedUserLayout from '../../../components/UnconnectedUserLayout.js'
import { AlertSnackbarContext } from '../../../contexts/AlertSnackbarProvider.js'
import { useSetupAdminMutation } from '../../services/adminQueries.js'

export default function AdminSetup() {
  const [password, setPassword] = useState('')
  const [passwordRepeat, setPasswordRepeat] = useState('')
  const { t } = useTranslation()
  const setupAdminMutation = useSetupAdminMutation()
  const { isPending } = setupAdminMutation
  const { setAlertContent } = use(AlertSnackbarContext)
  const theme = useTheme()
  const isMobile: boolean = useMediaQuery(theme.breakpoints.only('xs'))

  const MIN_PASSWORD_LENGTH = 8

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      setAlertContent({
        messageI18nKey: 'password_input_helper_text_too_short',
        severity: 'error',
        alertOpen: true,
      })
      return
    }
    if (password !== passwordRepeat) {
      setAlertContent({
        messageI18nKey: 'password_input_helper_text_not_match',
        severity: 'error',
        alertOpen: true,
      })
      return
    }
    setupAdminMutation.mutate(password)
  }

  const mainContentBoxStyle = {
    textAlign: 'center',
    marginTop: isMobile ? '30%' : 0,
  }

  return (
    <UnconnectedUserLayout
      pageName={t('admin_page_setup_title')}
      message={
        'This is the admin password account, you need to configure it to access the other step of the configuration.'
      }
    >
      <Box sx={mainContentBoxStyle}>
        <div>
          <TextField value="admin" name="username" autoComplete="username" disabled size="small" label="Username" />
        </div>
        <div>
          <TextField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            type="password"
            label={t('admin_page_password_placeholder')}
            autoComplete="new-password"
            disabled={isPending}
            size="small"
          />
        </div>
        <div>
          <TextField
            value={passwordRepeat}
            onChange={(e) => setPasswordRepeat(e.target.value)}
            name="password"
            error={passwordRepeat !== password}
            type="password"
            label={t('admin_page_password_repeat_placeholder')}
            autoComplete="new-password"
            disabled={isPending}
            size="small"
          />
        </div>
      </Box>
      <Box style={{ textAlign: 'center', marginTop: '16px', textWrap: 'nowrap' }}>
        <Fab variant="extended" color="primary" type="submit" disabled={isPending} onClick={handleSubmit}>
          <GroupAddRounded />
          <Typography sx={{ marginLeft: '4%' }}>{t('admin_page_create_button')}</Typography>
        </Fab>
      </Box>
    </UnconnectedUserLayout>
  )
}
