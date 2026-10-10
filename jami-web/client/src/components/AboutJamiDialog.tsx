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
import { Box, Link, Typography } from '@mui/material'
import { use } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { CustomThemeContext } from '../contexts/CustomThemeProvider.js'
import JamiLogo from '../icons/logo-jami-net.svg?react'
import JamiLogoWhite from '../icons/logo-jami-net-white.svg?react'
import {
  contributorsCommunityManagement,
  contributorsDevelopers,
  contributorsMedia,
  contributorsSpecialThanks,
} from '../utils/contributors.js'
import BaseButton from './common/BaseButton.js'
import BaseIconButton from './common/BaseIconButton.js'
import BaseModalDialog from './common/BaseModalDialog.js'
import { ContentCopyIcon, FavoriteBorderIcon, FeedbackIcon } from './SvgIcon.js'
import { VolunteerActivismIcon } from './SvgIcon.js'

interface AboutJamiDialogProps {
  open: boolean
  onClose: () => void
}

/** Version, licence and credits. Reachable from the welcome page and the account menu. */
export default function AboutJamiDialog({ open, onClose }: AboutJamiDialogProps) {
  const { t } = useTranslation()
  const { setAlertContent } = use(AlertSnackbarContext)
  const { mode } = use(CustomThemeContext)
  const isDark = mode === 'dark'

  const handleCopyVersion = async () => {
    try {
      await navigator.clipboard.writeText(`${__GIT_COMMIT_HASH__}-${__JAMI_CORE_VERSION__}`)
      setAlertContent({
        messageI18nKey: 'copied_to_clipboard',
        severity: 'success',
        alertOpen: true,
      })
    } catch {
      setAlertContent({
        messageI18nKey: 'unknown_error_alert',
        severity: 'error',
        alertOpen: true,
      })
    }
  }

  return (
    <BaseModalDialog
      open={open}
      selectedValue=""
      title={t('about_jami')}
      onClose={onClose}
      closePolicy={['escapeKeyDown', 'backdropClick']}
      dialogWidth="500px"
      actions={
        <>
          <BaseButton
            variant="text"
            startIcon={<FavoriteBorderIcon />}
            onClick={() => {
              window.open('https://jami.net/donate/', '_blank', 'noopener,noreferrer')
            }}
          >
            {t('donate')}
          </BaseButton>
          <BaseButton
            variant="text"
            startIcon={<VolunteerActivismIcon />}
            onClick={() => {
              window.open('https://jami.net/contribute/', '_blank', 'noopener,noreferrer')
            }}
          >
            {t('contribute')}
          </BaseButton>
          <BaseButton
            variant="text"
            startIcon={<FeedbackIcon />}
            onClick={() => {
              window.open('mailto:jami@gnu.org')
            }}
          >
            {t('feedback')}
          </BaseButton>
        </>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', minWidth: 0 }}>
        <Box sx={{ boxSizing: 'border-box', flex: '1 1 0', minWidth: 0, paddingRight: '8px' }}>
          {isDark ? (
            <JamiLogoWhite style={{ display: 'block', height: 'auto', width: '100%' }} />
          ) : (
            <JamiLogo style={{ display: 'block', height: 'auto', width: '100%' }} />
          )}
        </Box>
        <Box
          sx={{
            backgroundColor: 'background.paper',
            borderRadius: '12px',
            maxWidth: '100%',
            minWidth: '180px',
            padding: '8px',
            width: 'fit-content',
          }}
        >
          <Typography sx={{ fontWeight: 'bolder' }}>Euclid</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box>
              <Typography variant="body2" sx={{ color: 'grey' }}>
                {t('version')} :{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {__GIT_COMMIT_HASH__}
                </Box>
              </Typography>
              <Typography variant="body2" sx={{ color: 'grey' }}>
                Core:{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>
                  {__JAMI_CORE_VERSION__}
                </Box>
              </Typography>
            </Box>
            <BaseIconButton
              aria-label={t('copy_to_clipboard')}
              onClick={handleCopyVersion}
              size="small"
              sx={{ marginRight: '-5px' }}
              tooltip={t('copy_to_clipboard')}
            >
              <ContentCopyIcon fontSize="small" />
            </BaseIconButton>
          </Box>
        </Box>
      </Box>
      <Box sx={{ marginBottom: '24px' }}>
        <Typography variant="body2">
          <Trans
            i18nKey="about_jami_text"
            components={{ jamiLink: <Link href="https://jami.net/" rel="noreferrer" target="_blank" /> }}
          />
        </Typography>
        <Typography variant="body2" sx={{ marginTop: '8px' }}>
          <Trans
            i18nKey="about_jami_text_warranty"
            components={{
              gplLink: <Link href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noreferrer" target="_blank" />,
            }}
          />
        </Typography>
        <Typography variant="body2" sx={{ marginTop: '8px' }}>
          © 2015-2025 <Link href="https://savoirfairelinux.com/">Savoir-faire Linux</Link>
        </Typography>
      </Box>
      <Box
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: '12px',
          maxHeight: '240px',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            boxSizing: 'border-box',
            maxHeight: '240px',
            overflowY: 'auto',
            padding: '12px',
            scrollbarGutter: 'stable',
          }}
        >
          <Typography sx={{ fontWeight: 'bolder', marginBottom: '8px' }}>{t('developers')}</Typography>
          {contributorsDevelopers.map((contributor) => (
            <Typography variant="body2" key={contributor}>
              {contributor}
            </Typography>
          ))}
          <br />
          <Typography sx={{ fontWeight: 'bolder', marginBottom: '8px' }}>{t('media')}</Typography>
          {contributorsMedia.map((contributor) => (
            <Typography variant="body2" key={contributor}>
              {contributor}
            </Typography>
          ))}
          <br />
          <Typography sx={{ fontWeight: 'bolder', marginBottom: '8px' }}>{t('community_management')}</Typography>
          {contributorsCommunityManagement.map((contributor) => (
            <Typography variant="body2" key={contributor}>
              {contributor}
            </Typography>
          ))}
          <br />
          <Typography sx={{ fontWeight: 'bolder', marginBottom: '8px' }}>{t('special_thanks_to')}</Typography>
          {contributorsSpecialThanks.map((contributor) => (
            <Typography variant="body2" key={contributor}>
              {contributor}
            </Typography>
          ))}
          <br />
          <Typography variant="body2">{t('about_jami_text_volunteers')}</Typography>
        </Box>
      </Box>
    </BaseModalDialog>
  )
}
