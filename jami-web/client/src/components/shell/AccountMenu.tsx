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
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Typography } from '@mui/material'
import axios from 'axios'
import { use, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { useAuthContext } from '../../contexts/AuthProvider.js'
import { useContactProfilePicture } from '../../services/contactQueries.js'
import { apiUrl } from '../../utils/constants.js'
import { isElectronMode } from '../../utils/electron.js'
import AboutJamiDialog from '../AboutJamiDialog.js'
import ConversationAvatar from '../ConversationAvatar.js'
import QrCodeModal from '../QrCodeModal.js'
import { InfoIcon, LogoutIcon, PeopleIcon, QrCodeIcon } from '../SvgIcon.js'
import Tooltip from '../Tooltip.js'

interface LocalAccount {
  id: string
  registeredName: string
  displayName: string
}

interface AccountMenuProps {
  compact?: boolean
}

/**
 * The account destination of the navigation rail: the avatar opens the actions
 * that used to live in the footer account switcher.
 */
export default function AccountMenu({ compact }: AccountMenuProps) {
  const { t } = useTranslation()
  const { account, logout, switchAccount } = useAuthContext()
  const { setAlertContent } = use(AlertSnackbarContext)
  const profilePictureQuery = useContactProfilePicture(account.getUri())
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [isQrCodeOpen, setIsQrCodeOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [localAccounts, setLocalAccounts] = useState<LocalAccount[]>([])
  const electron = isElectronMode()

  useEffect(() => {
    if (!electron) {
      return
    }
    axios
      .get<{ accounts: LocalAccount[] }>('/auth/local-accounts', { baseURL: apiUrl })
      .then(({ data }) => setLocalAccounts(data.accounts))
      .catch((error) => console.error('Failed to list local accounts', error))
  }, [electron])

  const closeMenu = useCallback(() => setAnchorEl(null), [])

  const selectAccount = useCallback(
    async (id: string) => {
      closeMenu()
      try {
        const { data } = await axios.post('/auth/switch-account', { accountId: id }, { baseURL: apiUrl })
        localStorage.setItem('lastLoginAccountId', id)
        switchAccount(data.accessToken)
      } catch (error) {
        console.error('Failed to switch account', error)
        setAlertContent({
          messageI18nKey: 'account_switch_error',
          severity: 'error',
          alertOpen: true,
        })
      }
    },
    [closeMenu, setAlertContent, switchAccount],
  )

  const otherAccounts = localAccounts.filter((localAccount) => localAccount.id !== account.id)

  return (
    <>
      <Stack sx={{ alignItems: 'center', gap: 0.25 }}>
        {/* Not a destination: it opens a menu, so it takes the round hit target of
            the avatar itself rather than the rectangle the rail items sit in. */}
        <Tooltip title={t('account_menu')} placement={compact ? 'top' : 'right'}>
          <IconButton
            aria-label={t('account_menu')}
            aria-haspopup="menu"
            aria-expanded={anchorEl !== null}
            onClick={(event) => setAnchorEl(event.currentTarget)}
            // Matches the hit target a rail item paints on hover, so the account
            // does not read as the smallest thing in the rail.
            sx={{ p: compact ? 0.5 : 1 }}
          >
            <ConversationAvatar
              displayName={account.getDisplayName() || account.getRegisteredName()}
              contactUri={account.getUri()}
              src={profilePictureQuery.data ?? undefined}
              sx={{ width: 40, height: 40 }}
            />
          </IconButton>
        </Tooltip>
        {compact && (
          <Typography variant="caption" noWrap sx={{ maxWidth: '100%', px: 0.5, color: 'text.secondary' }}>
            {t('account_menu')}
          </Typography>
        )}
      </Stack>
      <Menu
        anchorEl={anchorEl}
        open={anchorEl !== null}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {electron &&
          otherAccounts.map((localAccount) => (
            <MenuItem key={localAccount.id} onClick={() => selectAccount(localAccount.id)}>
              <ListItemIcon>
                <PeopleIcon />
              </ListItemIcon>
              <ListItemText>
                {localAccount.registeredName || localAccount.displayName || localAccount.id.slice(0, 8) + '…'}
              </ListItemText>
            </MenuItem>
          ))}
        {electron && otherAccounts.length > 0 && <Divider />}
        <MenuItem
          onClick={() => {
            closeMenu()
            setIsQrCodeOpen(true)
          }}
        >
          <ListItemIcon>
            <QrCodeIcon />
          </ListItemIcon>
          <ListItemText>{t('contact_details_qr_code')}</ListItemText>
        </MenuItem>
        {/* Wide screens reach About Jami from the welcome page, which narrow
            screens never show, so only they carry it in the menu. */}
        {compact && (
          <MenuItem
            onClick={() => {
              closeMenu()
              setIsAboutOpen(true)
            }}
          >
            <ListItemIcon>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText>{t('about_jami')}</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem data-cy="logout-button" onClick={logout}>
          <ListItemIcon>
            <LogoutIcon color="error" />
          </ListItemIcon>
          <ListItemText>{t('logout')}</ListItemText>
        </MenuItem>
      </Menu>
      <QrCodeModal account={account} open={isQrCodeOpen} onClose={() => setIsQrCodeOpen(false)} />
      <AboutJamiDialog open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  )
}
