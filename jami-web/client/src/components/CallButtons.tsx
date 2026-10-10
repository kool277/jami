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

import { IconButtonProps } from '@mui/material'
import { styled } from '@mui/material/styles'
import { ChangeEvent, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useCallManagerContext } from '../contexts/CallManagerProvider.js'
import { useUserMediaContext } from '../contexts/UserMediaProvider.js'
import { CallStatus, VideoStatus } from '../services/CallManager.js'
import {
  ExpandableButton,
  type ExpandableButtonProps,
  type ExpandMenuRadioOption,
} from './common/ExpandableIconButton.js'
import FilledIconButton from './common/FilledIconButton.js'
import ToggleIconButton from './common/ToggleIconButton.js'
import {
  CallEndIcon,
  ChatBubbleIcon,
  ExtensionIcon,
  FullScreenIcon,
  GroupAddIcon,
  MicroIcon,
  MicroOffIcon,
  MoreVerticalIcon,
  PlaceAudioCallIcon,
  RecordingIcon,
  RoundCloseIcon,
  ScreenShareArrowIcon,
  ScreenShareStopIcon,
  VideoCameraIcon,
  VideoCameraOffIcon,
  VolumeIcon,
} from './SvgIcon.js'

const CallButton = styled((props: ExpandableButtonProps) => {
  return <ExpandableButton {...props} />
})({
  color: 'white',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
})

export const CallingChatButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  const { setIsChatShown } = useCallManagerContext()
  return (
    <CallButton
      aria-label={t('call_open_chat')}
      Icon={ChatBubbleIcon}
      onClick={() => {
        setIsChatShown((v) => !v)
      }}
      {...props}
    />
  )
}

export const CallingEndButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  const { endCall } = useCallManagerContext()
  return (
    <FilledIconButton
      paletteColor={(theme) => theme.palette.error}
      onClick={() => {
        endCall()
      }}
      aria-label={t('end_call')}
      tooltip={t('end_call')}
      {...props}
    >
      <CallEndIcon fontSize="inherit" />
    </FilledIconButton>
  )
}

export const CallingExtensionButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  return <CallButton aria-label={t('call_extensions')} Icon={ExtensionIcon} {...props} />
}

export const CallingFullScreenButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  const { setIsFullscreen } = useCallManagerContext()
  return (
    <CallButton
      aria-label={t('call_fullscreen')}
      Icon={FullScreenIcon}
      onClick={() => {
        setIsFullscreen((v) => !v)
      }}
      {...props}
    />
  )
}

export const CallingGroupButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  return <CallButton aria-label={t('call_add_participants')} Icon={GroupAddIcon} {...props} />
}

export const CallingMoreVerticalButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  return <CallButton aria-label={t('call_more_options')} Icon={MoreVerticalIcon} {...props} />
}

export const CallingRecordButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  return <CallButton aria-label={t('call_record')} Icon={RecordingIcon} {...props} />
}

export const CallingScreenShareButton = (props: ExpandableButtonProps) => {
  return <CallButton expandMenuOnClick IconButtonComp={ToggleScreenShareIconButton} {...props} />
}

const ToggleScreenShareIconButton = (props: IconButtonProps) => {
  const { videoStatus, updateVideoStatus } = useCallManagerContext()
  const { t } = useTranslation()
  const sharing = videoStatus === VideoStatus.ScreenShare
  const label = sharing ? t('call_screen_share_stop') : t('call_screen_share_start')

  return (
    <ToggleIconButton
      {...props}
      aria-label={label}
      tooltip={label}
      IconOff={ScreenShareArrowIcon}
      IconOn={ScreenShareStopIcon}
      pressed={sharing}
      onToggle={() => {
        updateVideoStatus((v) => (v !== VideoStatus.ScreenShare ? VideoStatus.ScreenShare : VideoStatus.Off))
      }}
    />
  )
}

const useMediaDeviceExpandMenuOptions = (kind: MediaDeviceKind): ExpandMenuRadioOption[] | undefined => {
  const { currentMediaDeviceIds, mediaDevices } = useUserMediaContext()

  const options = useMemo(
    () =>
      mediaDevices[kind].map((device) => ({
        key: device.deviceId,
        description: device.label,
      })),
    [mediaDevices, kind],
  )

  const currentDevice = currentMediaDeviceIds[kind]

  if (options.length === 0) {
    return undefined
  }
  return [
    {
      options,
      value: currentDevice.id ?? '',
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        currentDevice.setId(e.target.value)
      },
    },
  ]
}

export const CallingVolumeButton = (props: ExpandableButtonProps) => {
  const { t } = useTranslation()
  const options = useMediaDeviceExpandMenuOptions('audiooutput')

  return (
    <CallButton
      aria-label={t('call_volume_options')}
      expandMenuOnClick
      Icon={VolumeIcon}
      expandMenuOptions={options}
      {...props}
    />
  )
}

export const CallingMicButton = (props: ExpandableButtonProps) => {
  const options = useMediaDeviceExpandMenuOptions('audioinput')

  return <CallButton expandMenuOptions={options} IconButtonComp={ToggleAudioCameraIconButton} {...props} />
}

const ToggleAudioCameraIconButton = (props: IconButtonProps) => {
  const { isAudioOn, setIsAudioOn } = useCallManagerContext()
  const { t } = useTranslation()
  const label = isAudioOn ? t('call_microphone_mute') : t('call_microphone_unmute')
  return (
    <ToggleIconButton
      {...props}
      aria-label={label}
      tooltip={label}
      IconOn={MicroIcon}
      IconOff={MicroOffIcon}
      pressed={isAudioOn}
      onToggle={() => setIsAudioOn((v) => !v)}
    />
  )
}

export const CallingVideoCameraButton = (props: ExpandableButtonProps) => {
  const options = useMediaDeviceExpandMenuOptions('videoinput')

  return <CallButton expandMenuOptions={options} IconButtonComp={ToggleVideoCameraIconButton} {...props} />
}

const ToggleVideoCameraIconButton = (props: IconButtonProps) => {
  const { videoStatus, updateVideoStatus } = useCallManagerContext()
  const { t } = useTranslation()
  const cameraOn = videoStatus === VideoStatus.Camera
  const label = cameraOn ? t('call_camera_turn_off') : t('call_camera_turn_on')
  return (
    <ToggleIconButton
      {...props}
      aria-label={label}
      tooltip={label}
      IconOn={VideoCameraIcon}
      IconOff={VideoCameraOffIcon}
      pressed={cameraOn}
      onToggle={() => {
        updateVideoStatus((v) => (v !== VideoStatus.Camera ? VideoStatus.Camera : VideoStatus.Off))
      }}
    />
  )
}

// Calling pending/receiving interface
export const CallingCancelButton = (props: IconButtonProps) => {
  const { t } = useTranslation()
  const { endCall } = useCallManagerContext()

  return (
    <FilledIconButton
      aria-label={t('call_cancel')}
      tooltip={t('call_cancel')}
      onClick={() => {
        endCall()
      }}
      paletteColor={(theme) => theme.palette.error}
      {...props}
    >
      <CallEndIcon fontSize="inherit" />
    </FilledIconButton>
  )
}

export const CallingAnswerAudioButton = (props: IconButtonProps) => {
  const { t } = useTranslation()
  const { acceptCall, callStatus } = useCallManagerContext()

  return (
    <FilledIconButton
      disabled={callStatus === CallStatus.Loading || callStatus === CallStatus.Connecting}
      aria-label={t('call_answer_audio')}
      tooltip={t('call_answer_audio')}
      onClick={() => {
        acceptCall(false)
      }}
      paletteColor={(theme) => theme.palette.success}
      {...props}
    >
      <PlaceAudioCallIcon fontSize="inherit" />
    </FilledIconButton>
  )
}

export const CallingAnswerVideoButton = (props: IconButtonProps) => {
  const { t } = useTranslation()
  const { acceptCall, callStatus } = useCallManagerContext()
  return (
    <FilledIconButton
      disabled={callStatus === CallStatus.Connecting || callStatus === CallStatus.Loading}
      aria-label={t('call_answer_video')}
      tooltip={t('call_answer_video')}
      onClick={() => {
        acceptCall(true)
      }}
      paletteColor={(theme) => theme.palette.success}
      {...props}
    >
      <VideoCameraIcon fontSize="inherit" />
    </FilledIconButton>
  )
}

export const CallingRefuseButton = (props: IconButtonProps) => {
  const { t } = useTranslation()
  const { endCall } = useCallManagerContext()
  return (
    <FilledIconButton
      aria-label={t('decline_call')}
      tooltip={t('decline_call')}
      onClick={() => {
        endCall()
      }}
      paletteColor={(theme) => theme.palette.error}
      {...props}
    >
      <RoundCloseIcon fontSize="inherit" />
    </FilledIconButton>
  )
}
