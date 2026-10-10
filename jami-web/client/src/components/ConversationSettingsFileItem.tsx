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

import { Box, Typography, useMediaQuery, useTheme } from '@mui/material'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useConversationContext } from '../contexts/ConversationProvider.js'
import { GetDownloadedFile, useGetAutoDownloadLimit, useGetDownloadFileInfo } from '../services/dataTransferQueries.js'
import { useDataSizeUnits } from '../utils/units.js'
import ConversationAvatar from './ConversationAvatar.js'
import EllipsisMiddle from './EllipsisMiddle.js'
import MediaViewer from './MediaViewer.js'
import { AttachFileIcon, AudioFileIcon, PictureAsPdfIcon, VideoFileIcon } from './SvgIcon.js'

interface ConversationSettingsFileItemProps {
  displayName: string
  timeStamp: number
  totalSize: number
  fileId: string
  author: string
  messageId: string
  listView?: boolean
}

const AUTHOR_OVERLAY_TRANSITION_MS = 150
const ATTACHMENT_RADIUS = '10px'
const AUTHOR_AVATAR_SIZE = '16px'

const ConversationSettingsFileItem = ({
  displayName,
  timeStamp,
  totalSize,
  fileId,
  author,
  messageId,
  listView = false,
}: ConversationSettingsFileItemProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { t } = useTranslation()
  const { members, conversationId } = useConversationContext()
  const limitData = useGetAutoDownloadLimit()

  const downloadFile = GetDownloadedFile(conversationId)
  const betterTotalSize = useDataSizeUnits(totalSize)

  const [blobUrl, setBlobUrl] = useState<string | undefined>()
  const [blob, setBlob] = useState<Blob>()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [isAuthorOverlayMounted, setIsAuthorOverlayMounted] = useState(false)
  const [isAuthorOverlayVisible, setIsAuthorOverlayVisible] = useState(false)
  const [isAuthorNameElided, setIsAuthorNameElided] = useState(false)
  const authorOverlayHideTimeoutRef = useRef<number | undefined>(undefined)
  const authorOverlayShowFrameRef = useRef<number | undefined>(undefined)
  const authorNameRef = useRef<HTMLSpanElement | null>(null)

  const conversationMember = members.find((member) => member.contact.uri === author)
  const authorName =
    conversationMember?.getDisplayName() ||
    conversationMember?.contact.registeredName ||
    conversationMember?.contact.uri ||
    author
  const content = { messageId: messageId, fileId: fileId || '' }
  const isFileAlreadyInCache = useGetDownloadFileInfo({ content, conversationId })

  const extension = displayName.split('.').pop() || '' // get the extension of the file; This is not robust enough

  const getFileType = useCallback(() => {
    const fileTypes: { [key: string]: string } = {
      image: 'jpeg|jpg|gif|png|webp',
      video: 'mp4|webm|mov',
      audio: 'mp3|wav|ogg',
      text: 'txt|c|h|cpp|hpp|java|py|js|ts|css|sh|sql|php|json|xml|yml|yaml|ini|md|log|conf|tex|csv',
      pdf: 'pdf',
    }

    for (const [type, extensions] of Object.entries(fileTypes)) {
      if (new RegExp(`\\.(${extensions})$`).test(displayName)) {
        return type
      }
    }
    return 'none'
  }, [displayName])

  const showAuthorOverlay = () => {
    if (authorOverlayHideTimeoutRef.current !== undefined) {
      window.clearTimeout(authorOverlayHideTimeoutRef.current)
    }
    setIsAuthorOverlayMounted(true)
    setIsAuthorNameElided(false)
    authorOverlayShowFrameRef.current = window.requestAnimationFrame(() => {
      setIsAuthorOverlayVisible(true)
    })
  }

  const hideAuthorOverlay = () => {
    if (authorOverlayShowFrameRef.current !== undefined) {
      window.cancelAnimationFrame(authorOverlayShowFrameRef.current)
    }
    setIsAuthorOverlayVisible(false)
    authorOverlayHideTimeoutRef.current = window.setTimeout(() => {
      setIsAuthorOverlayMounted(false)
    }, AUTHOR_OVERLAY_TRANSITION_MS)
  }

  useEffect(
    () => () => {
      if (authorOverlayHideTimeoutRef.current !== undefined) {
        window.clearTimeout(authorOverlayHideTimeoutRef.current)
      }
      if (authorOverlayShowFrameRef.current !== undefined) {
        window.cancelAnimationFrame(authorOverlayShowFrameRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const authorNameElement = authorNameRef.current
    if (!isAuthorOverlayMounted || !authorNameElement) return

    const updateNameElision = () => {
      setIsAuthorNameElided(authorNameElement.scrollWidth > authorNameElement.clientWidth)
    }

    const animationFrame = window.requestAnimationFrame(updateNameElision)

    if (!window.ResizeObserver) {
      return () => window.cancelAnimationFrame(animationFrame)
    }

    const resizeObserver = new ResizeObserver(updateNameElision)
    resizeObserver.observe(authorNameElement)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [isAuthorOverlayMounted])

  const getBlob = useCallback(
    async (type: string) => {
      try {
        const result = await downloadFile.mutateAsync({
          messageId,
          fileId,
        })

        if (!result) return

        const mimeType = type === 'pdf' ? 'application/pdf' : `${type}/${extension.toLowerCase()}`

        const blob = new Blob([result.blob], { type: mimeType })
        const url = URL.createObjectURL(blob)

        setBlob(blob)
        setBlobUrl(url)
        setIsDownloaded(true)

        return url
      } catch (error) {
        console.error('Failed to get blob:', error)
      }
    },
    [downloadFile, messageId, fileId, extension],
  )

  useEffect(() => {
    const shouldFetchBlob =
      limitData.isSuccess &&
      limitData.data &&
      isFileAlreadyInCache.isSuccess &&
      isFileAlreadyInCache.data &&
      !isDownloaded
    if (!shouldFetchBlob) return

    const totalSizeMb = totalSize / 1000000
    const isUnderSizeLimit = totalSizeMb < limitData.data.limit

    if (isUnderSizeLimit || isFileAlreadyInCache.data) {
      const fileType = getFileType()

      void Promise.resolve().then(() => getBlob(fileType))

      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl)
        }
      }
    }
  }, [
    limitData.isSuccess,
    limitData.data,
    isFileAlreadyInCache.isSuccess,
    isFileAlreadyInCache.data,
    totalSize,
    isDownloaded,
    getBlob,
    getFileType,
    blobUrl,
  ])

  // only for video, img and audio files
  const handleDownload = async () => {
    // download the file on computer
    if (fileId === '') {
      return
    }
    if (blobUrl) {
      const link = document.createElement('a')
      link.href = blobUrl
      link.setAttribute('href', blobUrl)
      const fileName = displayName ? displayName : 'file'
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const result = await downloadFile.mutateAsync({ messageId: messageId, fileId: fileId || '' })
      if (!result) {
        return
      }
      const url = result.blobUrl
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('href', url)
      const fileName = displayName ? displayName : 'file'
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const iconStyle = { color: 'white', fontSize: '40px', width: '100%', padding: '4px' }

  const getIcon = () => {
    switch (getFileType()) {
      case 'image':
        return undefined
      case 'video':
        return <VideoFileIcon sx={iconStyle} />
      case 'audio':
        return <AudioFileIcon sx={iconStyle} />
      case 'pdf':
        return <PictureAsPdfIcon sx={iconStyle} />
      default:
        return <AttachFileIcon sx={iconStyle} />
    }
  }

  if (fileId === '') {
    return
  }

  return (
    <>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: listView ? 'flex-start' : 'center',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            width: listView && getFileType() === 'image' ? '100%' : isMobile ? '70px' : '90px',
            height: listView && getFileType() === 'image' ? 'auto' : isMobile ? '70px' : '90px',
            aspectRatio: listView && getFileType() === 'image' ? '16 / 9' : undefined,
            backgroundColor: 'grey',
            backgroundImage: `url(${blobUrl})`,
            backgroundSize: 'cover',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            borderRadius: ATTACHMENT_RADIUS,
            ':hover': { cursor: 'pointer' },
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
          }}
          onMouseEnter={showAuthorOverlay}
          onMouseLeave={hideAuthorOverlay}
          onClick={() => {
            if (isDownloaded) {
              setIsModalOpen(true)
              return
            }
            getBlob(getFileType())
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignContent: 'center',
              alignItems: 'center',
              gap: '2px',
              width: '100%',
            }}
          >
            {getIcon()}

            {!(getFileType() === 'image' && isDownloaded) && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    color: 'white',
                    typography: 'caption',
                    width: '100%',
                    textAlign: 'center',
                    maxWidth: '100px',
                    flexWrap: 'nowrap',
                    justifyContent: 'center',
                    fontWeight: 'bolder',
                  }}
                >
                  {displayName.length > 15 ? <EllipsisMiddle text={displayName} /> : displayName}
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    color: 'white',
                    typography: 'caption',
                    width: '100%',
                    textAlign: 'center',
                    maxWidth: '90px',
                    flexWrap: 'nowrap',
                    justifyContent: 'center',
                  }}
                >
                  {betterTotalSize}
                </Box>
              </>
            )}
            {!isDownloaded && (
              <Box
                sx={{
                  display: 'flex',
                  color: 'white',
                  typography: 'caption',
                  width: '100%',
                  textAlign: 'center',
                  maxWidth: '90px',
                  flexWrap: 'nowrap',
                  justifyContent: 'center',
                  marginTop: '-5px',
                }}
              >
                {t('click_to_download')}
              </Box>
            )}
          </Box>
          {isAuthorOverlayMounted && (
            <Box
              sx={{
                bottom: 0,
                left: 0,
                pointerEvents: 'none',
                position: 'absolute',
                right: 0,
                opacity: isAuthorOverlayVisible ? 1 : 0,
                transition: `opacity ${AUTHOR_OVERLAY_TRANSITION_MS}ms ease-out`,
              }}
            >
              <Box
                sx={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  borderTopRightRadius: isAuthorNameElided ? 0 : ATTACHMENT_RADIUS,
                  color: 'common.white',
                  display: 'flex',
                  gap: 0.5,
                  maxWidth: '100%',
                  minWidth: 0,
                  padding: 0.25,
                  paddingRight: 0.5,
                  width: isAuthorNameElided ? '100%' : 'fit-content',
                }}
              >
                <ConversationAvatar
                  contactUri={author}
                  displayName={authorName}
                  sx={{ flexShrink: 0, height: AUTHOR_AVATAR_SIZE, width: AUTHOR_AVATAR_SIZE }}
                />
                <Typography
                  ref={authorNameRef}
                  component="span"
                  noWrap
                  title={authorName}
                  variant="caption"
                  sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {authorName}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      <MediaViewer
        timeStamp={timeStamp}
        handleDownload={handleDownload}
        fileName={displayName}
        totalSize={betterTotalSize}
        blob={blob}
        blobUrl={blobUrl || ''}
        member={conversationMember}
        open={isModalOpen}
        type={getFileType()}
        onClose={() => {
          setIsModalOpen(false)
        }}
      />
    </>
  )
}

export default ConversationSettingsFileItem
