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
import { Autocomplete, Box, IconButton, InputAdornment, Stack, Switch, TextField } from '@mui/material'
import { AccountDetails } from '@savoirfairelinux/jami-web-common'
import { motion } from 'framer-motion'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAutocompleteMenuAnimation } from '../../components/common/useAutocompleteMenuAnimation.js'
import { ContactIdentity } from '../../components/ContactIdentity.js'
import ConversationAvatar from '../../components/ConversationAvatar.js'
import { AddModeratorIcon, DeleteIcon } from '../../components/SvgIcon.js'
import { useAuthContext } from '../../contexts/AuthProvider.js'
import { Contact } from '../../models/contact.js'
import {
  useContactListQuery,
  useContactsSearchQuery,
  useJamsContactsSearchQuery,
} from '../../services/contactQueries.js'
import { thumbnailVariants } from '../../themes/MotionVariants.js'
import { SettingsRow, SettingsSection } from './SettingsPage.js'

export default function CallPreferences() {
  const { t } = useTranslation()
  const { account, axiosInstance } = useAuthContext()

  const [moderatorState, setModeratorState] = useState({
    source: account.defaultModerators,
    values: account.defaultModerators,
  })
  const moderators =
    moderatorState.source === account.defaultModerators ? moderatorState.values : account.defaultModerators
  const [defaultModeratorUri, setDefaultModeratorUri] = useState('')
  const [details, setDetails] = useState(account.details)
  const moderatorInputId = useId()
  const moderatorMenuAnimation = useAutocompleteMenuAnimation()
  const contactListQuery = useContactListQuery()
  const contactsSearchQuery = useContactsSearchQuery(defaultModeratorUri)
  const jamsContactsSearchQuery = useJamsContactsSearchQuery(defaultModeratorUri)

  const localModeratorOptions = useMemo(
    () =>
      (contactListQuery.data ?? []).map((contactDetails) => {
        const contact = new Contact(contactDetails.id, contactDetails.username)
        contact.displayName = contactDetails.displayName
        return contact
      }),
    [contactListQuery.data],
  )
  const moderatorOptions = useMemo(() => {
    const normalizedSearch = defaultModeratorUri.trim().toLocaleLowerCase()
    const matchingLocalContacts = localModeratorOptions.filter(
      (contact) =>
        !normalizedSearch ||
        contact.getDisplayName().toLocaleLowerCase().includes(normalizedSearch) ||
        contact.uri.toLocaleLowerCase().includes(normalizedSearch),
    )

    return Array.from(
      new Map(
        [...matchingLocalContacts, ...(contactsSearchQuery.data ?? []), ...(jamsContactsSearchQuery.data ?? [])].map(
          (contact) => [contact.uri, contact],
        ),
      ).values(),
    )
  }, [contactsSearchQuery.data, defaultModeratorUri, jamsContactsSearchQuery.data, localModeratorOptions])

  const addModerator = async (
    uri = defaultModeratorUri,
    contact = moderatorOptions.find((option) => option.uri === uri),
  ) => {
    if (uri) {
      await axiosInstance.put(`/default-moderators/${encodeURIComponent(uri)}`)
      setModeratorState((currentState) => {
        const currentModerators =
          currentState.source === account.defaultModerators ? currentState.values : account.defaultModerators
        return {
          source: account.defaultModerators,
          values: currentModerators.some((moderator) => moderator.uri === uri)
            ? currentModerators
            : [...currentModerators, contact ?? new Contact(uri)],
        }
      })
      setDefaultModeratorUri('')
    }
  }

  const removeModerator = async (uri: string) => {
    await axiosInstance.delete(`/default-moderators/${encodeURIComponent(uri)}`)
    setModeratorState((currentState) => {
      const currentModerators =
        currentState.source === account.defaultModerators ? currentState.values : account.defaultModerators
      return {
        source: account.defaultModerators,
        values: currentModerators.filter((moderator) => moderator.uri !== uri),
      }
    })
  }

  const handleToggle = async (key: keyof AccountDetails, value: boolean) => {
    const newDetails: Partial<AccountDetails> = {}
    newDetails[key] = value ? 'true' : 'false'
    await axiosInstance.patch('/account', newDetails)
    account.updateDetails(newDetails)
    setDetails(account.details)
  }

  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={{
        enter: { transition: { staggerChildren: 0.05 } },
        exit: { transition: { staggerChildren: 0.02 } },
      }}
    >
      <Stack spacing={2}>
        <motion.div variants={thumbnailVariants}>
          <SettingsSection>
            <SettingsRow
              title={t('settings_rendezvous_point')}
              description={t('settings_rendezvous_point_description')}
              control={
                <Switch
                  edge="end"
                  onChange={(e) => handleToggle('Account.rendezVous', e.target.checked)}
                  checked={details['Account.rendezVous'] === 'true'}
                  slotProps={{ input: { 'aria-label': t('settings_rendezvous_point') } }}
                />
              }
            />
            <SettingsRow
              title={t('settings_allow_unknown_peers')}
              description={t('settings_allow_unknown_peers_description')}
              control={
                <Switch
                  edge="end"
                  onChange={(e) => handleToggle('DHT.PublicInCalls', e.target.checked)}
                  checked={details['DHT.PublicInCalls'] === 'true'}
                  slotProps={{ input: { 'aria-label': t('settings_allow_unknown_peers') } }}
                />
              }
            />
          </SettingsSection>
        </motion.div>

        <motion.div variants={thumbnailVariants}>
          <SettingsSection title={t('settings_default_moderators')}>
            <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pb: 0.5 }}>
              <Box
                component="label"
                htmlFor={moderatorInputId}
                sx={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  p: 0,
                  m: -1,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                {t('settings_add_moderator')}
              </Box>
              <Autocomplete
                id={moderatorInputId}
                open={moderatorMenuAnimation.open}
                slots={moderatorMenuAnimation.slots}
                slotProps={moderatorMenuAnimation.slotProps}
                options={moderatorOptions}
                value={null}
                inputValue={defaultModeratorUri}
                getOptionLabel={(contact) => contact.getDisplayName()}
                isOptionEqualToValue={(option, value) => option.uri === value.uri}
                loading={contactsSearchQuery.isFetching || jamsContactsSearchQuery.isFetching}
                filterOptions={(options) => options}
                openOnFocus
                onOpen={moderatorMenuAnimation.onOpen}
                onClose={moderatorMenuAnimation.onClose}
                onInputChange={(_, value, reason) => {
                  moderatorMenuAnimation.onInputChange(value, reason)
                  setDefaultModeratorUri(value)
                }}
                onChange={(_, contact) => {
                  if (contact) {
                    void addModerator(contact.uri, contact)
                  }
                }}
                renderOption={({ key, ...props }, contact) => (
                  <Box key={key} component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ConversationAvatar
                      displayName={contact.getDisplayName()}
                      contactUri={contact.uri}
                      sx={{ width: 32, height: 32 }}
                    />
                    <ContactIdentity
                      uri={contact.uri}
                      displayName={contact.displayName}
                      registeredName={contact.registeredName}
                      primaryVariant="body2"
                      secondaryVariant="caption"
                    />
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="outlined"
                    size="small"
                    fullWidth
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && defaultModeratorUri.trim()) {
                        event.preventDefault()
                        void addModerator()
                      }
                    }}
                    placeholder={t('settings_add_moderator_placeholder')}
                    slotProps={{
                      ...params.slotProps,
                      input: {
                        ...params.slotProps.input,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <AddModeratorIcon />
                            </InputAdornment>
                            {params.slotProps.input.startAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  ...moderatorMenuAnimation.popupIndicatorSx,
                }}
              />
            </Box>
            {moderators.length === 0 ? (
              <SettingsRow title={t('settings_no_moderator')} />
            ) : (
              moderators.map((moderator) => (
                <Box
                  component="li"
                  key={moderator.uri}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}
                >
                  <ConversationAvatar
                    displayName={moderator.getDisplayName()}
                    contactUri={moderator.uri}
                    sx={{ width: 32, height: 32 }}
                  />
                  <ContactIdentity
                    uri={moderator.uri}
                    displayName={moderator.displayName}
                    registeredName={moderator.registeredName}
                    primaryVariant="body1"
                    secondaryVariant="caption"
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    aria-label={t('settings_remove_moderator', { moderator: moderator.getDisplayName() })}
                    onClick={() => removeModerator(moderator.uri)}
                    size="medium"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))
            )}
          </SettingsSection>
        </motion.div>
      </Stack>
    </motion.div>
  )
}
