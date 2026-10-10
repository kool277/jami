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

import { Avatar, AvatarProps, Box, Dialog, Popover, Stack, Typography, useTheme } from '@mui/material'
import { type SxProps, type Theme } from '@mui/material/styles'
import { ReactNode, use, useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { useInView } from 'react-intersection-observer'

import { useAuthContext } from '../contexts/AuthProvider.js'
import { PresenceContext } from '../contexts/PresenceProvider.js'
import { ConversationMember } from '../models/conversation-member.js'
import { useContactProfilePicture } from '../services/contactQueries.js'
import { FileHandler } from '../utils/files.js'
import { getColor } from '../utils/messagecolor.js'
import BaseButton from './common/BaseButton.js'
import BaseIconButton from './common/BaseIconButton.js'
import FilledIconButton from './common/FilledIconButton.js'
import { useDialogHandler } from './Dialog.js'
import { CircleMaskOverlay, FileDragOverlay } from './Overlay.js'
import {
  CameraIcon,
  CancelIcon,
  CheckMarkIcon as Check,
  FolderIcon,
  GroupsIcon,
  MoodIcon,
  PenIcon,
  RefreshOutlinedIcon as RefreshOutlined,
  SentimentCalmIcon,
  SentimentExcitedIcon,
  Timer3AltIcon,
  TimerOffIcon,
} from './SvgIcon.js'

type ConversationAvatarProps = AvatarProps & {
  displayName: string
  contactUri: string
  presence?: boolean
  presenceBackgroundColor?: string
}

export default function ConversationAvatar({
  displayName,
  contactUri,
  presence,
  presenceBackgroundColor,
  src: srcProp,
  ...props
}: ConversationAvatarProps) {
  const { ref, inView } = useInView({
    fallbackInView: true,
    rootMargin: '200px 0px',
    triggerOnce: true,
  })
  const profilePictureQuery = useContactProfilePicture(contactUri, inView && !srcProp)
  const url = profilePictureQuery.data ?? undefined
  const src = srcProp || url
  const color = getColor(contactUri ? 'jami:' + contactUri : '')
  const initial = displayName.slice(0, 1).toUpperCase()

  if (presence) {
    return (
      <ConversationAvatarPresence buddy={contactUri} backgroundColor={presenceBackgroundColor}>
        <Avatar
          ref={ref}
          {...props}
          alt={displayName?.toUpperCase()}
          src={src}
          style={{ backgroundColor: color, color: '#E5E5E5' }}
        >
          {initial}
        </Avatar>
      </ConversationAvatarPresence>
    )
  }
  return (
    <Avatar
      ref={ref}
      {...props}
      alt={displayName?.toUpperCase()}
      src={src}
      style={{ backgroundColor: color, color: '#E5E5E5' }}
    >
      {initial}
    </Avatar>
  )
}

type GroupConversationAvatarProps = AvatarProps & {
  displayName: string
  members: ConversationMember[]
  src?: string
}

export function GroupConversationAvatar({ displayName, members, src, sx, ...props }: GroupConversationAvatarProps) {
  const visibleMembers = members
    .filter((member) => ['admin', 'member', 'invited'].includes(member.role ?? 'member'))
    .sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin'))
    .slice(0, 3)

  if (src) {
    return <ConversationAvatar {...props} displayName={displayName} contactUri="" src={src} sx={sx} />
  }

  if (visibleMembers.length === 0) {
    return (
      <Box
        {...props}
        role="img"
        aria-label={displayName}
        sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', ...sx }}
      >
        <Avatar
          aria-hidden
          sx={(theme) => ({
            width: '100%',
            height: '100%',
            backgroundColor: getGroupAvatarBackground(theme),
            color: theme.palette.text.secondary,
          })}
        >
          <GroupsIcon />
        </Avatar>
      </Box>
    )
  }

  return (
    <Box
      {...props}
      role="img"
      aria-label={displayName}
      sx={{
        position: 'relative',
        width: 40,
        height: 40,
        flexShrink: 0,
        overflow: 'hidden',
        borderRadius: '50%',
        backgroundColor: getGroupAvatarBackground,
        ...sx,
      }}
    >
      {visibleMembers.map((member, index) => (
        <ConversationAvatar
          key={member.contact.uri}
          aria-hidden
          displayName={member.getDisplayName()}
          contactUri={member.contact.uri}
          sx={getGroupMemberAvatarSx(visibleMembers.length, index)}
        />
      ))}
    </Box>
  )
}

function getGroupAvatarBackground(theme: Theme) {
  return theme.Panel?.outerBackground || theme.palette.grey[theme.palette.mode === 'dark' ? 900 : 200]
}

function getGroupMemberAvatarSx(count: number, index: number): SxProps<Theme> {
  if (count === 1) {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%' }
  }

  if (count === 2) {
    return index === 0
      ? { position: 'absolute', top: '13%', left: '13%', width: '46%', height: '46%' }
      : { position: 'absolute', right: '13%', bottom: '13%', width: '46%', height: '46%' }
  }

  return [
    { position: 'absolute', top: '12%', left: '14%', width: '46%', height: '46%' },
    { position: 'absolute', top: '33%', right: '7%', width: '34%', height: '34%' },
    { position: 'absolute', bottom: '7%', left: '29%', width: '34%', height: '34%' },
  ][index]
}

const ConversationAvatarPresence = ({
  children,
  buddy,
  backgroundColor,
}: {
  children: ReactNode
  buddy: string
  backgroundColor?: string
}) => {
  const theme = useTheme()
  const { getPresence } = use(PresenceContext)
  const presenceState = getPresence(buddy)

  if (!presenceState || presenceState === 0) {
    return children
  }

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      {children}
      <Box
        sx={{
          position: 'absolute',
          right: '-2px',
          bottom: '-2px',
          width: '30%',
          aspectRatio: '1',
          backgroundColor: backgroundColor || theme.palette.background.paper,
          borderRadius: '50%',
        }}
        aria-hidden="true"
      >
        <Box
          sx={{
            position: 'absolute',
            inset: '20%',
            backgroundColor: '#33cc33',
            borderRadius: '50%',
          }}
        />
      </Box>
    </Box>
  )
}

type AvatarEditorProps = {
  onAvatarChange: (avatar: File | null) => void
}

export const AvatarEditor = ({ onAvatarChange }: AvatarEditorProps) => {
  const { t } = useTranslation()
  const { account } = useAuthContext()
  const profilePictureQuery = useContactProfilePicture(account.getUri())
  const url = profilePictureQuery.data ?? undefined
  const [editionToolsIsOpen, setEditionToolsIsOpen] = useState(false)
  const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null)
  const [avatarHandler, setAvatarHandler] = useState<FileHandler | null>(null)
  const avatarHandlerRef = useRef<FileHandler | null>(null)
  const photoTakerHandler = useDialogHandler()

  const replaceAvatarHandler = useCallback((nextHandler: FileHandler | null) => {
    const previousHandler = avatarHandlerRef.current
    if (previousHandler && previousHandler !== nextHandler) {
      URL.revokeObjectURL(previousHandler.url)
    }
    avatarHandlerRef.current = nextHandler
    setAvatarHandler(nextHandler)
  }, [])

  useEffect(() => {
    return () => {
      if (avatarHandlerRef.current) {
        URL.revokeObjectURL(avatarHandlerRef.current.url)
      }
    }
  }, [])

  const onFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      const fileHandler = new FileHandler(acceptedFiles[0])
      replaceAvatarHandler(fileHandler)
      setEditionToolsIsOpen(false)
      onAvatarChange(fileHandler.file)
    },
    [onAvatarChange, replaceAvatarHandler],
  )

  const {
    getRootProps,
    getInputProps,
    open: openFilePicker,
    isDragActive,
  } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpeg', '.jpg'],
    },
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDrop: onFilesDrop,
  })

  const openPhotoTaker = useCallback(() => {
    photoTakerHandler.openDialog()
    setEditionToolsIsOpen(false)
  }, [photoTakerHandler])

  const onPhotoConfirm = useCallback(
    (fileHandler: FileHandler) => {
      replaceAvatarHandler(fileHandler)
      onAvatarChange(fileHandler.file)
    },
    [onAvatarChange, replaceAvatarHandler],
  )

  const removeAvatar = useCallback(() => {
    replaceAvatarHandler(null)
    setEditionToolsIsOpen(false)
    onAvatarChange(null)
  }, [onAvatarChange, replaceAvatarHandler])

  const closeTools = useCallback(() => {
    setEditionToolsIsOpen(false)
  }, [])

  return (
    <Stack
      {...getRootProps()}
      sx={{
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {isDragActive && <FileDragOverlay />}
      <input {...getInputProps()} />
      {/* Avatar preview */}
      <Stack
        sx={{
          height: '150px',
          width: '150px',
          position: 'relative',
        }}
      >
        <ConversationAvatar
          src={avatarHandler?.url || url}
          contactUri={account.getUri()}
          displayName={account.getDisplayName()}
          sx={{ width: '100%', height: '100%', fontSize: '4rem', fontWeight: 500 }}
        />
        <FilledIconButton
          aria-label={t('change_picture')}
          tooltip={t('change_picture')}
          sx={{
            position: 'absolute',
            top: 1,
            right: 1,
            width: 32,
            height: 32,
            opacity: 1,
          }}
          onClick={(event) => {
            setPopupAnchor(event.currentTarget)
            setEditionToolsIsOpen(true)
          }}
        >
          <PenIcon fontSize="inherit" />
        </FilledIconButton>
      </Stack>
      <Popover
        open={editionToolsIsOpen}
        anchorEl={popupAnchor}
        onClose={closeTools}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 240,
              p: 2,
              borderRadius: 1,
            },
          },
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h4">{t('change_picture')}</Typography>
          <Stack spacing={1}>
            <BaseButton startIcon={<CameraIcon />} onClick={openPhotoTaker} variant="outlined">
              {t('picture_take')}
            </BaseButton>
            <BaseButton startIcon={<FolderIcon />} onClick={openFilePicker} variant="outlined">
              {t('picture_upload')}
            </BaseButton>
            {(avatarHandler || url) && (
              <BaseButton color="error" startIcon={<CancelIcon />} onClick={removeAvatar} variant="text">
                {t('picture_remove')}
              </BaseButton>
            )}
          </Stack>
        </Stack>
      </Popover>
      <PhotoTakerDialog {...photoTakerHandler.props} onConfirm={onPhotoConfirm} />
    </Stack>
  )
}

type PhotoTakerProps = {
  open: boolean
  onClose: () => void
  onConfirm: (photoHandler: FileHandler) => void
}

const photoFeedback = [
  { messageKey: 'photo_looking_good', Icon: SentimentCalmIcon },
  { messageKey: 'photo_nice_shot', Icon: MoodIcon },
  { messageKey: 'photo_smile_approved', Icon: SentimentExcitedIcon },
] as const

const circleLengthPercentage = '50%'
const PhotoTakerDialog = ({ open, onClose, onConfirm }: PhotoTakerProps) => {
  const { t } = useTranslation()
  const [isPaused, setIsPaused] = useState(false)
  const [isTimerEnabled, setIsTimerEnabled] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<(typeof photoFeedback)[number] | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null) // video.srcObject is not reliable
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt')

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
  }, [])

  useEffect(() => {
    navigator.permissions
      // @ts-ignore
      // Firefox is unable to query camera permissions. Hopefully this will work soon.
      .query({ name: 'camera' })
      .then((permissionStatus) => {
        setPermissionState(permissionStatus.state)
        permissionStatus.onchange = () => {
          setPermissionState(permissionStatus.state)
          setStream(null)
        }
      })
      .catch(() => {
        // Expected behavior on Firefox
      })
  }, [])

  useEffect(() => {
    // Start stream when dialog opens, stop it when dialog closes
    if (open && !stream) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          setStream(stream)
          setIsPaused(false)
          // This would be useless if we could query 'camera' permission on Firefox
          setPermissionState('granted')
        })
        .catch(() => {
          setStream(null)
          setPermissionState('denied')
        })
    }
    if (!open) {
      stream?.getTracks()?.forEach((track) => track.stop())
      void Promise.resolve().then(() => setStream(null))
    }
  }, [open, stream, permissionState])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      if (stream) {
        video.srcObject = stream
        video.play()
      } else {
        video.srcObject = null
      }
    }
  }, [stream])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    video?.pause()
    setIsPaused(true)
    setFeedback(photoFeedback[Math.floor(Math.random() * photoFeedback.length)])
  }, [])

  const takePhoto = useCallback(() => {
    if (isTimerEnabled) {
      setCountdown(3)
      return
    }

    capturePhoto()
  }, [capturePhoto, isTimerEnabled])

  useEffect(() => {
    if (countdown === null || !open) {
      return
    }

    const timer = window.setTimeout(() => {
      if (countdown === 1) {
        capturePhoto()
        setCountdown(null)
        return
      }

      setCountdown(countdown - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [capturePhoto, countdown, open])

  const cancelPhoto = useCallback(() => {
    const video = videoRef.current
    video?.play()
    setIsPaused(false)
    setFeedback(null)
  }, [])

  const closePhotoTaker = useCallback(() => {
    setCountdown(null)
    setFeedback(null)
    setIsPaused(false)
    onClose()
  }, [onClose])

  const savePhoto = useCallback(async () => {
    const video = videoRef.current
    if (video) {
      // The PhotoTaker shows a circle in the middle of the camera's image.
      // We have to cut the picture, otherwise the avatar would be larger to what the user saw in boundaries of the circle
      // The circle's diameter is a percentage of the image's diagonal length
      const diagonalLength = Math.sqrt(Math.pow(video.offsetWidth, 2) + Math.pow(video.offsetHeight, 2))
      const avatarSize = diagonalLength * (parseInt(circleLengthPercentage) / 100)
      const xMargin = (video.offsetWidth - avatarSize) / 2
      const yMargin = (video.offsetHeight - avatarSize) / 2

      // @ts-ignore
      // Seems like Typescript does not know yet about OffscreenCanvas. Lets pretend it is HTMLCanvasElement for now
      const offscreenCanvas: HTMLCanvasElement = new OffscreenCanvas(avatarSize, avatarSize)
      const context = offscreenCanvas.getContext('2d')
      if (context) {
        context.setTransform(-1, 0, 0, 1, avatarSize, 0) // mirror
        context.drawImage(video, -xMargin, -yMargin, video.offsetWidth, video.offsetHeight)
        // @ts-ignore
        // convertToBlob is only on OffscreenCanvas, not HTMLCanvasElement, which has "toBlob" instead
        const blob: Blob = await offscreenCanvas.convertToBlob()
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        const fileHandler = new FileHandler(file)
        onConfirm(fileHandler)
        closePhotoTaker()
      }
    }
  }, [closePhotoTaker, onConfirm])

  if (permissionState === 'denied') {
    return (
      <Dialog open={open} onClose={closePhotoTaker}>
        <Stack
          spacing={2}
          sx={{
            width: 360,
            minHeight: 280,
            px: 4,
            py: 5,
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <Box component="img" src="/jami-failure.svg" alt="" sx={{ width: 96, height: 96 }} />
          <Typography variant="h5">{t('permission_denied_title')}</Typography>
          <Typography color="text.secondary" variant="body2">
            {t('permission_denied_details')}
          </Typography>
          <BaseButton onClick={closePhotoTaker}>{t('dialog_close')}</BaseButton>
        </Stack>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={closePhotoTaker}>
      <Stack>
        <Stack
          sx={{
            position: 'relative',
          }}
        >
          <BaseIconButton
            aria-label={t('photo_camera_close')}
            tooltip={t('photo_camera_close')}
            onClick={closePhotoTaker}
            sx={{ position: 'absolute', top: 1, right: 1, zIndex: 101, color: 'common.white' }}
          >
            <CancelIcon />
          </BaseIconButton>
          {stream && <CircleMaskOverlay size={circleLengthPercentage} />}
          {countdown !== null && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                color: 'common.white',
                typography: 'h1',
                fontWeight: 700,
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.7)',
                zIndex: 100,
              }}
            >
              {countdown}
            </Box>
          )}
          <video ref={setVideoRef} style={{ transform: 'rotateY(180deg)' /* mirror */ }} />
        </Stack>
        <Stack
          spacing={2}
          sx={{
            minHeight: isPaused ? '128px' : '89px',
            pt: isPaused ? 2 : 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {isPaused && feedback && (
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }} variant="h3">
              <feedback.Icon fontSize="large" />
              {t(feedback.messageKey)}
            </Typography>
          )}
          <Stack direction="row" spacing="10px">
            {isPaused ? (
              <>
                <FilledIconButton
                  aria-label={t('photo_retake')}
                  tooltip={t('photo_retake')}
                  size="large"
                  sx={{ width: 48, height: 48 }}
                  onClick={cancelPhoto}
                >
                  <RefreshOutlined fontSize="large" />
                </FilledIconButton>
                <FilledIconButton
                  aria-label={t('photo_confirm')}
                  tooltip={t('photo_confirm')}
                  size="large"
                  sx={{ width: 48, height: 48 }}
                  onClick={savePhoto}
                >
                  <Check fontSize="large" />
                </FilledIconButton>
              </>
            ) : (
              <>
                <BaseIconButton
                  aria-label={t('photo_capture')}
                  tooltip={t('photo_capture')}
                  size="large"
                  disabled={countdown !== null}
                  onClick={takePhoto}
                >
                  <CameraIcon />
                </BaseIconButton>
                <BaseIconButton
                  aria-label={t('photo_timer')}
                  aria-pressed={isTimerEnabled}
                  tooltip={t(isTimerEnabled ? 'photo_timer_disable' : 'photo_timer_enable')}
                  size="large"
                  disabled={countdown !== null}
                  sx={{ color: isTimerEnabled ? 'primary.main' : undefined }}
                  onClick={() => setIsTimerEnabled((enabled) => !enabled)}
                >
                  {isTimerEnabled ? <Timer3AltIcon /> : <TimerOffIcon />}
                </BaseIconButton>
              </>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Dialog>
  )
}
