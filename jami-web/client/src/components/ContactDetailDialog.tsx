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
import { ContactDetails as ContactDetailType } from '@savoirfairelinux/jami-web-common'
import { useTranslation } from 'react-i18next'

import { IdentifierText } from './ContactIdentity.js'
import ConversationAvatar from './ConversationAvatar.js'
import { InfosDialog } from './Dialog.js'
import { DialogContentList } from './Dialog.js'
import JamiQrCode from './JamiQrCode.js'
import LoadingPage from './Loading.js'

interface ContactDetailDialogProps {
  contactDetail: ContactDetailType | undefined
  open: boolean
  onClose: () => void
}

const ContactDetailDialog = ({ contactDetail, open, onClose }: ContactDetailDialogProps) => {
  const { t } = useTranslation()

  if (contactDetail === undefined) {
    return <InfosDialog open={open} onClose={onClose} title="" content={<LoadingPage />} />
  }

  const displayName = contactDetail.displayName || contactDetail.username || contactDetail.id
  const items = [
    {
      label: t('contact_details_name'),
      value: displayName,
    },
    {
      label: t('contact_details_identifier'),
      value: <IdentifierText variant="body1">{contactDetail.id}</IdentifierText>,
    },
    {
      label: t('contact_details_qr_code'),
      value: <JamiQrCode size={80} value={contactDetail.id} />,
    },
  ]

  return (
    <InfosDialog
      open={open}
      onClose={onClose}
      icon={
        <ConversationAvatar
          contactUri={contactDetail.id}
          sx={{ width: 'inherit', height: 'inherit' }}
          displayName={displayName}
        />
      }
      title={displayName}
      content={<DialogContentList title={t('contact_details_dialog_title')} items={items} />}
    />
  )
}

export default ContactDetailDialog
