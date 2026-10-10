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
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createOptionalContext } from '../hooks/createOptionalContext.js'
import { WithChildren } from '../utils/utils.js'

type MediaDeviceIdState = {
  id: string | undefined
  setId: (id: string | undefined) => void | Promise<void>
}
type CurrentMediaDeviceIds = Record<MediaDeviceKind, MediaDeviceIdState>

export type MediaDevicesInfo = Record<MediaDeviceKind, MediaDeviceInfo[]>
export type MediaInputKind = 'audio' | 'video'
export type MediaInputIds = Record<MediaInputKind, string | false | undefined>

type IUserMediaContext = {
  localStream: MediaStream | undefined
  updateLocalStream: (mediaDeviceIds?: MediaInputIds) => Promise<MediaStream | undefined>
  screenShareLocalStream: MediaStream | undefined
  updateScreenShare: (isOn: boolean) => Promise<MediaStream | undefined>

  mediaDevices: MediaDevicesInfo
  currentMediaDeviceIds: CurrentMediaDeviceIds

  setAudioInputDeviceId: (id: string) => void
  setAudioOutputDeviceId: (id: string) => void
  setVideoDeviceId: (id: string) => void

  stopMedias: () => void
}

const optionalUserMediaContext = createOptionalContext<IUserMediaContext>('UserMediaContext')
export const useUserMediaContext = optionalUserMediaContext.useOptionalContext

export default ({ children }: WithChildren) => {
  const [localStream, setLocalStream] = useState<MediaStream>()
  const [screenShareLocalStream, setScreenShareLocalStream] = useState<MediaStream>()

  const [mediaDevices, setMediaDevices] = useState<MediaDevicesInfo>({
    audioinput: [],
    audiooutput: [],
    videoinput: [],
  })
  const [audioInputDeviceId, setAudioInputDeviceId] = useState<string>()
  const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>()
  const [videoDeviceId, setVideoDeviceId] = useState<string>()

  const getMediaDevices = useCallback(async (): Promise<MediaDevicesInfo> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      // TODO: On Firefox, some devices can sometime be duplicated (2 devices can share the same deviceId). Using a map
      //       and then converting it to an array makes it so that there is no duplicate. If we find a way to prevent
      //       Firefox from listing 2 devices with the same deviceId, we can remove this logic.
      const newMediaDevices: Record<MediaDeviceKind, Record<string, MediaDeviceInfo>> = {
        audioinput: {},
        audiooutput: {},
        videoinput: {},
      }

      for (const device of devices) {
        newMediaDevices[device.kind][device.deviceId] = device
      }

      return {
        audioinput: Object.values(newMediaDevices.audioinput),
        audiooutput: Object.values(newMediaDevices.audiooutput),
        videoinput: Object.values(newMediaDevices.videoinput),
      }
    } catch (e) {
      throw new Error('Could not get media devices', { cause: e })
    }
  }, [])

  const updateLocalStream = useCallback(
    async (mediaDeviceIds?: MediaInputIds) => {
      const devices = await getMediaDevices()

      let audioConstraint: MediaTrackConstraints | boolean = devices.audioinput.length !== 0
      let videoConstraint: MediaTrackConstraints | boolean = devices.videoinput.length !== 0

      if (!audioConstraint && !videoConstraint) {
        return
      }

      if (mediaDeviceIds?.audio !== undefined) {
        audioConstraint = mediaDeviceIds.audio !== false ? { deviceId: mediaDeviceIds.audio } : false
      }
      if (mediaDeviceIds?.video !== undefined) {
        videoConstraint = mediaDeviceIds.video !== false ? { deviceId: mediaDeviceIds.video } : false
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraint,
          video: videoConstraint,
        })

        for (const track of stream.getTracks()) {
          track.enabled = false
        }

        setLocalStream(stream)
        return stream
      } catch (e) {
        throw new Error('Could not get media devices', { cause: e })
      }
    },
    [getMediaDevices],
  )

  const currentMediaDeviceIds: CurrentMediaDeviceIds = useMemo(() => {
    const createSetIdForDeviceKind = (mediaInputKind: MediaInputKind) => async (id: string | undefined) => {
      const mediaDeviceIds = {
        audio: audioInputDeviceId,
        video: videoDeviceId,
      }

      mediaDeviceIds[mediaInputKind] = id

      await updateLocalStream(mediaDeviceIds)
    }

    return {
      audioinput: {
        id: audioInputDeviceId,
        setId: createSetIdForDeviceKind('audio'),
      },
      audiooutput: {
        id: audioOutputDeviceId,
        setId: setAudioOutputDeviceId,
      },
      videoinput: {
        id: videoDeviceId,
        setId: createSetIdForDeviceKind('video'),
      },
    }
  }, [updateLocalStream, audioInputDeviceId, audioOutputDeviceId, videoDeviceId])

  const updateScreenShare = useCallback(
    async (isOn: boolean) => {
      if (isOn) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        })

        setScreenShareLocalStream(stream)
        return stream
      } else {
        if (screenShareLocalStream) {
          for (const track of screenShareLocalStream.getTracks()) {
            track.stop()
          }
        }

        setScreenShareLocalStream(undefined)
      }
    },
    [screenShareLocalStream],
  )

  useEffect(() => {
    const updateMediaDevices = async () => {
      try {
        const newMediaDevices = await getMediaDevices()

        if (newMediaDevices.audiooutput.length !== 0 && !audioOutputDeviceId) {
          setAudioOutputDeviceId(newMediaDevices.audiooutput[0].deviceId)
        }

        setMediaDevices(newMediaDevices)
      } catch (e) {
        console.error('Could not update media devices:', e)
      }
    }

    navigator.mediaDevices.addEventListener('devicechange', updateMediaDevices)
    updateMediaDevices()

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', updateMediaDevices)
    }
  }, [getMediaDevices, audioOutputDeviceId])

  const stopStream = useCallback((stream: MediaStream) => {
    const localTracks = stream.getTracks()
    if (localTracks) {
      for (const track of localTracks) {
        track.stop()
      }
    }
  }, [])

  const stopMedias = useCallback(() => {
    if (localStream) {
      stopStream(localStream)
    }
    if (screenShareLocalStream) {
      stopStream(screenShareLocalStream)
    }
  }, [localStream, screenShareLocalStream, stopStream])

  const value = useMemo(
    () => ({
      localStream,
      updateLocalStream,
      screenShareLocalStream,
      updateScreenShare,
      mediaDevices,
      currentMediaDeviceIds,
      setAudioInputDeviceId,
      setAudioOutputDeviceId,
      setVideoDeviceId,
      stopMedias,
    }),
    [
      localStream,
      updateLocalStream,
      screenShareLocalStream,
      updateScreenShare,
      mediaDevices,
      currentMediaDeviceIds,
      setAudioInputDeviceId,
      setAudioOutputDeviceId,
      setVideoDeviceId,
      stopMedias,
    ],
  )

  return <optionalUserMediaContext.Context value={value}>{children}</optionalUserMediaContext.Context>
}
