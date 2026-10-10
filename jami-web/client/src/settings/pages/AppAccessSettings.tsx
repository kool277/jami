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
import {
  Autocomplete,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { type ApiTokenInfo, type ApiTokenScope } from '@savoirfairelinux/jami-web-common'
import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import BaseButton from '../../components/common/BaseButton.js'
import {
  AccountCircleIcon,
  AudioCallIcon,
  ChatBubbleIcon,
  ContactIcon,
  KeyIcon,
  PermMediaIcon,
  TokenIcon,
  TrashBinIcon,
  TwoSheetsIcon,
} from '../../components/SvgIcon.js'
import {
  useApiTokensQuery,
  useCreateApiTokenMutation,
  useRevokeApiTokenMutation,
} from '../../services/apiTokenQueries.js'
import { SettingsPage, SettingsRow, SettingsSection } from '../components/SettingsPage.js'

const expiryOptions = [
  { value: '2592000', label: 'app_access_expiry_30_days' },
  { value: '7776000', label: 'app_access_expiry_90_days' },
  { value: '31536000', label: 'app_access_expiry_one_year' },
  { value: 'never', label: 'app_access_expiry_never' },
] as const

type PermissionResource = 'account' | 'calls' | 'contacts' | 'conversations' | 'files'
type PermissionAccess = 'read' | 'write'

interface Permission {
  resource: PermissionResource
  access: PermissionAccess
}

const permissionResources: Array<{
  resource: PermissionResource
  access: PermissionAccess[]
  Icon: typeof AccountCircleIcon
}> = [
  { resource: 'conversations', access: ['read', 'write'], Icon: ChatBubbleIcon },
  { resource: 'contacts', access: ['read', 'write'], Icon: ContactIcon },
  { resource: 'calls', access: ['read', 'write'], Icon: AudioCallIcon },
  { resource: 'files', access: ['read', 'write'], Icon: PermMediaIcon },
  { resource: 'account', access: ['read', 'write'], Icon: AccountCircleIcon },
]

function formatDate(date: string | undefined, locale: string): string {
  return date ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(date)) : ''
}

function tokenPermissions(token: ApiTokenInfo, t: TFunction): string {
  if (token.scopes.length === 0) {
    return t('app_access_full_access')
  }

  return (['read', 'write'] as const)
    .map((access) => {
      const resources = permissionResources
        .filter(({ resource }) => {
          const hasWriteAccess = token.scopes.includes(`${resource}:write` as ApiTokenScope)
          return access === 'write'
            ? hasWriteAccess
            : token.scopes.includes(`${resource}:read` as ApiTokenScope) && !hasWriteAccess
        })
        .map(({ resource }) => t(`app_access_permission_${resource}`))

      return resources.length > 0 ? `${t(`app_access_access_${access}`)}: ${resources.join(', ')}` : undefined
    })
    .filter((value): value is string => value !== undefined)
    .join('; ')
}

export function toScopes(permissions: Permission[]): ApiTokenScope[] {
  return permissions.flatMap(({ resource, access }) =>
    access === 'read'
      ? [`${resource}:read` as ApiTokenScope]
      : ([`${resource}:read`, `${resource}:write`] as ApiTokenScope[]),
  )
}

export default function AppAccessSettings() {
  const { t, i18n } = useTranslation()
  const { data: tokens, isLoading, isError } = useApiTokensQuery()
  const createMutation = useCreateApiTokenMutation()
  const revokeMutation = useRevokeApiTokenMutation()
  const [createOpen, setCreateOpen] = useState(false)
  const [secret, setSecret] = useState<string>()
  const [tokenToRevoke, setTokenToRevoke] = useState<ApiTokenInfo>()
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState<(typeof expiryOptions)[number]['value']>('never')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const hasAvailablePermissions = permissions.length < permissionResources.length

  const closeCreateDialog = () => {
    setCreateOpen(false)
    setName('')
    setExpiry('never')
    setPermissions([])
  }

  const createToken = async () => {
    const response = await createMutation.mutateAsync({
      name,
      scopes: toScopes(permissions),
      expiresInSeconds: expiry === 'never' ? undefined : Number(expiry),
    })
    closeCreateDialog()
    setSecret(response.token)
  }

  const addPermission = (resource: PermissionResource) => {
    const defaultAccess = permissionResources.find((permission) => permission.resource === resource)?.access[0]
    if (!defaultAccess) {
      return
    }
    setPermissions((current) => [...current, { resource, access: defaultAccess }])
  }

  const changePermissionAccess = (resource: PermissionResource, access: PermissionAccess) => {
    setPermissions((current) =>
      current.map((permission) => (permission.resource === resource ? { ...permission, access } : permission)),
    )
  }

  const removePermission = (resource: PermissionResource) => {
    setPermissions((current) => current.filter((permission) => permission.resource !== resource))
  }

  return (
    <SettingsPage title={t('app_access_title')} description={t('app_access_description')}>
      <SettingsSection title={t('app_access_tokens_title')} description={t('app_access_tokens_description')}>
        {isLoading && <SettingsRow title={t('app_access_loading')} />}
        {isError && <SettingsRow title={t('app_access_load_error')} />}
        {!isLoading && !isError && tokens?.length === 0 && <SettingsRow title={t('app_access_no_tokens')} />}
        {tokens?.map((token) => (
          <SettingsRow
            key={token.id}
            title={
              <>
                {token.name}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {' — '}
                  {tokenPermissions(token, t)}
                </Typography>
              </>
            }
            description={
              token.expiresAt && (
                <>
                  <Typography component="span" variant="caption">
                    {t('app_access_expires_on')}{' '}
                  </Typography>
                  <Typography component="span" variant="caption" sx={{ fontStyle: 'italic' }}>
                    {formatDate(token.expiresAt, i18n.language)}
                  </Typography>
                </>
              )
            }
            titleControl={
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                {token.lastUsedAt && (
                  <Typography color="text.secondary" variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                    {t('app_access_last_used_at', { date: formatDate(token.lastUsedAt, i18n.language) })}
                  </Typography>
                )}
                <BaseButton
                  color="error"
                  variant="contained"
                  size="small"
                  onClick={() => setTokenToRevoke(token)}
                  sx={{
                    bgcolor: 'error.main',
                    color: 'error.contrastText',
                    '&:hover': { bgcolor: 'error.dark' },
                  }}
                >
                  {t('app_access_revoke')}
                </BaseButton>
              </Stack>
            }
          />
        ))}
        <Stack sx={{ alignItems: 'flex-end', px: 2, py: 1.5 }}>
          <BaseButton startIcon={<KeyIcon />} onClick={() => setCreateOpen(true)}>
            {t('app_access_create_token')}
          </BaseButton>
        </Stack>
      </SettingsSection>

      <Dialog open={createOpen} onClose={closeCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('app_access_create_token')}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2, pt: 1 }}>
            <TextField
              autoFocus
              required
              size="small"
              label={t('app_access_token_name')}
              value={name}
              slotProps={{
                htmlInput: { maxLength: 100 },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <TokenIcon />
                    </InputAdornment>
                  ),
                },
              }}
              onChange={(event) => setName(event.target.value)}
            />
            <Stack direction="row" sx={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 1 }}>
              <Stack sx={{ gap: 0.5 }}>
                <Typography color="text.secondary" variant="caption">
                  {t('app_access_expiry')}
                </Typography>
                <Chip
                  clickable
                  color={expiry === expiryOptions[0].value ? 'primary' : 'default'}
                  label={t(expiryOptions[0].label)}
                  variant={expiry === expiryOptions[0].value ? 'filled' : 'outlined'}
                  onClick={() => setExpiry(expiryOptions[0].value)}
                />
              </Stack>
              {expiryOptions.slice(1).map((option) => (
                <Chip
                  key={option.value}
                  clickable
                  color={expiry === option.value ? 'primary' : 'default'}
                  label={t(option.label)}
                  variant={expiry === option.value ? 'filled' : 'outlined'}
                  onClick={() => setExpiry(option.value)}
                />
              ))}
            </Stack>
            <Stack>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Stack
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderBottom: permissions.length > 0 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body1">{t('app_access_permissions')}</Typography>
                  <Autocomplete
                    disabled={!hasAvailablePermissions}
                    getOptionLabel={(resource) => t(`app_access_permission_${resource}`)}
                    openOnFocus
                    options={permissionResources
                      .filter(({ resource }) => !permissions.some((permission) => permission.resource === resource))
                      .map(({ resource }) => resource)}
                    renderInput={(params) => (
                      <TextField {...params} label={t('app_access_add_permission')} size="small" />
                    )}
                    sx={{ minWidth: 180 }}
                    value={null}
                    onChange={(_, resource) => {
                      if (resource) {
                        addPermission(resource)
                      }
                    }}
                  />
                </Stack>
                {permissions.length === 0 ? (
                  <Typography color="text.secondary" variant="body2" sx={{ px: 1.5, py: 2 }}>
                    {t('app_access_no_permissions')}
                  </Typography>
                ) : (
                  permissions.map((permission) => {
                    const resource = permissionResources.find((value) => value.resource === permission.resource)
                    const PermissionIcon = resource?.Icon
                    return (
                      <Stack
                        key={permission.resource}
                        direction={{ xs: 'column', sm: 'row' }}
                        sx={{ alignItems: { sm: 'center' }, gap: 1, px: 1.5, py: 1 }}
                      >
                        <Stack direction="row" sx={{ flex: 1, alignItems: 'center', gap: 1 }}>
                          {PermissionIcon && <PermissionIcon color="action" />}
                          <Stack sx={{ gap: 0.25 }}>
                            <Typography>{t(`app_access_permission_${permission.resource}`)}</Typography>
                            <Typography color="text.secondary" variant="body2">
                              {t(`app_access_permission_${permission.resource}_description`)}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Stack
                          direction="row"
                          sx={{ alignItems: 'center', alignSelf: { xs: 'flex-end', sm: 'center' }, gap: 0.5 }}
                        >
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <InputLabel id={`app-access-${permission.resource}-access-label`}>
                              {t('app_access_permission_access')}
                            </InputLabel>
                            <Select
                              labelId={`app-access-${permission.resource}-access-label`}
                              label={t('app_access_permission_access')}
                              value={permission.access}
                              onChange={(event) =>
                                changePermissionAccess(permission.resource, event.target.value as PermissionAccess)
                              }
                            >
                              {resource?.access.map((access) => (
                                <MenuItem key={access} value={access}>
                                  {t(`app_access_access_${access}`)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <IconButton
                            aria-label={t('app_access_remove_permission', {
                              permission: t(`app_access_permission_${permission.resource}`),
                            })}
                            onClick={() => removePermission(permission.resource)}
                            sx={{ alignSelf: 'center' }}
                          >
                            <TrashBinIcon />
                          </IconButton>
                        </Stack>
                      </Stack>
                    )
                  })
                )}
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <BaseButton variant="text" onClick={closeCreateDialog}>
            {t('dialog_cancel')}
          </BaseButton>
          <BaseButton
            onClick={createToken}
            disabled={!name.trim() || permissions.length === 0 || createMutation.isPending}
          >
            {t('app_access_create_token')}
          </BaseButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={secret !== undefined}
        onClose={() => setSecret(undefined)}
        fullWidth
        maxWidth="sm"
        aria-describedby="app-access-token-warning"
      >
        <DialogTitle>{t('app_access_token_created')}</DialogTitle>
        <DialogContent>
          <Stack sx={{ gap: 2 }}>
            <Typography>{t('app_access_token_created_description')}</Typography>
            <Stack direction="row" sx={{ alignItems: 'flex-start', gap: 1 }}>
              <Typography sx={{ flex: 1, fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{secret}</Typography>
              <IconButton
                aria-label={t('copy_to_clipboard')}
                onClick={() => navigator.clipboard.writeText(secret ?? '')}
              >
                <TwoSheetsIcon />
              </IconButton>
            </Stack>
            <Typography id="app-access-token-warning" color="error" variant="body2">
              {t('app_access_token_copy_warning')}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <BaseButton onClick={() => setSecret(undefined)}>{t('dialog_close')}</BaseButton>
        </DialogActions>
      </Dialog>

      <Dialog open={tokenToRevoke !== undefined} onClose={() => setTokenToRevoke(undefined)}>
        <DialogTitle>{t('app_access_revoke_title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('app_access_revoke_description', { name: tokenToRevoke?.name })}</Typography>
        </DialogContent>
        <DialogActions>
          <BaseButton variant="text" onClick={() => setTokenToRevoke(undefined)}>
            {t('dialog_cancel')}
          </BaseButton>
          <BaseButton
            color="error"
            onClick={async () => {
              if (tokenToRevoke) {
                await revokeMutation.mutateAsync(tokenToRevoke.id)
                setTokenToRevoke(undefined)
              }
            }}
            disabled={revokeMutation.isPending}
          >
            {t('app_access_revoke')}
          </BaseButton>
        </DialogActions>
      </Dialog>
    </SettingsPage>
  )
}
