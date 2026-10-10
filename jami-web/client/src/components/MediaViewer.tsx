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

import { Box, Modal, Typography, useMediaQuery, useTheme } from '@mui/material'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { ConversationMember } from '../models/conversation-member.js'
import AudioPlayer from './AudioPlayer.js'
import ConversationAvatar from './ConversationAvatar.js'
import EllipsisMiddle from './EllipsisMiddle.js'
import { AttachFileIcon, CloseIcon, DownloadIcon, LinkIcon } from './SvgIcon.js'

interface MediaViewerProps {
  totalSize?: string
  fileName?: string
  blobUrl: string
  blob?: Blob
  open: boolean
  onClose: () => void
  member?: ConversationMember
  handleDownload?: () => void
  type?: string
  timeStamp?: number
}

export default function MediaViewer({
  totalSize,
  fileName,
  blobUrl,
  open,
  onClose,
  member,
  handleDownload,
  type,
  timeStamp,
  blob,
}: MediaViewerProps) {
  const theme = useTheme()
  const isMedium = useMediaQuery(theme.breakpoints.down('sm'))
  const isXs = useMediaQuery(theme.breakpoints.down(400))
  const fileType = type || 'image'

  const mediaStyle = {
    maxWidth: '90%',
    maxHeight: '80%',
    border: 'none',
    borderRadius: '10px',
    marginTop: '10px',
  }

  const displayFile = () => {
    switch (fileType) {
      case 'pdf':
        return (
          <iframe
            src={blobUrl}
            style={{
              border: 'none',
              width: '100%',
              height: '100%',
              maxHeight: '80%',
              maxWidth: '90%',
              borderRadius: '10px',
            }}
          />
        )
      case 'text':
        return (
          <iframe
            src={blobUrl}
            style={{
              backgroundColor: '#c4c4c2',
              border: 'none',
              width: '100%',
              height: '100%',
              maxHeight: '80%',
              maxWidth: '90%',
              borderRadius: '10px',
            }}
          />
        )
      case 'image':
        return <img src={blobUrl} alt="media" style={mediaStyle} />
      case 'video':
        return <video style={mediaStyle} src={blobUrl} controls />
      case 'audio':
        return <AudioPlayer blob={blob} isAccountMessage={true} />
      case 'none':
        return <DefaultFile displayName={fileName || 'File'} totalSize={totalSize || ''} />
      default:
        return <img src={blobUrl} alt="media" style={mediaStyle} />
    }
  }

  const displayTime = dayjs.unix(timeStamp || 0)
  const formattedTime = displayTime.format('YYYY-MM-DD HH:mm')

  return (
    <Modal
      onClose={onClose}
      open={open}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      }}
    >
      <>
        {member && (
          <Box sx={{ position: 'absolute', top: '0', left: '0', padding: '20px' }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', gap: '8px' }}>
              <ConversationAvatar
                displayName={member?.getDisplayName() || member.contact.registeredName || member.contact.uri}
                contactUri={member.contact.uri}
              />
              <Box>
                <Box sx={{ color: 'white', fontWeight: 'bold' }}>
                  {isMedium ? (
                    <Box sx={{ maxWidth: isXs ? '150px' : '200px' }}>
                      <EllipsisMiddle text={member.getDisplayName()} />
                    </Box>
                  ) : (
                    member.getDisplayName()
                  )}
                </Box>
                {member.contact.uri !== member.getDisplayName() && (
                  <Box
                    sx={{
                      maxWidth: isMedium ? '115px' : '160px',
                      color: 'white',
                      typography: 'caption',
                    }}
                  >
                    {isMedium ? <EllipsisMiddle text={member.contact.uri} /> : member.contact.uri}
                  </Box>
                )}
                {formattedTime && (
                  <Box sx={{ color: 'white', typography: 'caption' }}>
                    {'Sent the '}
                    {formattedTime}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ position: 'absolute', top: '0', right: '0', padding: '20px', pr: isMedium ? '10px' : '40px' }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: isXs ? '8px' : '16px' }}>
            <LinkIcon
              sx={{ height: '30px', width: '30px', color: 'white', ':hover': { cursor: 'pointer' } }}
              onClick={() => window.open(blobUrl)}
            />
            {handleDownload && (
              <DownloadIcon
                sx={{ height: '30px', width: '30px', color: 'white', ':hover': { cursor: 'pointer' } }}
                onClick={handleDownload}
              />
            )}
            <CloseIcon
              sx={{ height: '30px', width: '30px', color: 'white', ':hover': { cursor: 'pointer' } }}
              onClick={onClose}
            />
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            alignContent: 'center',
            height: '100%',
            width: '100%',
            marginTop: '50px',
          }}
        >
          {displayFile()}

          {fileName && (
            <Box sx={{ textAlign: 'center', color: 'white', marginTop: '10px', maxWidth: '85%' }}>
              {(isMedium && fileName.length > 30) || fileName.length > 150 ? (
                <EllipsisMiddle text={fileName} />
              ) : (
                fileName
              )}
            </Box>
          )}
        </Box>
      </>
    </Modal>
  )
}

interface DefaultFileProps {
  displayName: string
  totalSize: string
}

const DefaultFile = ({ displayName, totalSize }: DefaultFileProps) => {
  const extension = displayName.includes('.') ? displayName.split('.').slice(1).join('.') : ''
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
        height: '200px',
        width: '300px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          padding: '10px',
          width: '100%',
          height: '100%',
          borderRadius: '10px',
          justifyContent: 'center',
          alignItems: 'center',
          alignContent: 'center',
        }}
      >
        <Box
          sx={{
            backgroundColor: 'action.selected',
            fontSize: '80px',
            width: '80px',
            height: '80px',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <AttachFileIcon sx={{ fontSize: '50px', color: 'text.primary' }} />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: '20px',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '10px',
          pl: '0px',
          marginLeft: '-8px',
        }}
      >
        <Typography variant="body2">{t('extension') + extension}</Typography>
        <Typography variant="body2">{t('size') + totalSize}</Typography>
      </Box>
    </Box>
  )
}
