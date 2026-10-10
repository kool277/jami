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
import { HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { use } from 'react'

import { AlertSnackbarContext } from '../contexts/AlertSnackbarProvider.js'
import { useAuthContext } from '../contexts/AuthProvider.js'
import { apiUrl } from '../utils/constants.js'

const fileCache = new Map<string, { blob: Blob; blobUrl: string }>()

export const useSendFilesMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content: FormData) =>
      axiosInstance.post(
        `/data/${conversationId}`,

        content,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Accept: '*/*',
          },
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
  })
}

export const useTransferFileMutation = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  const { setAlertContent } = use(AlertSnackbarContext)

  return useMutation({
    mutationFn: ({
      conversationId,
      fileId,
      fileName,
      targetedConversations,
      comment,
    }: {
      conversationId: string
      fileId: string
      fileName: string
      targetedConversations: string[]
      comment: string
    }) =>
      axiosInstance.post(`/data/transfer-file/`, {
        conversationId,
        fileId,
        fileName,
        targetedConversations,
        comment,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', conversationId] }),
    onError: (e: any) => {
      if (e.response?.status === HttpStatusCode.NotFound) {
        setAlertContent({
          messageI18nKey: 'file_not_downloaded',
          severity: 'error',
          alertOpen: true,
        })
        return
      }
      console.error(e)
      setAlertContent({
        messageI18nKey: 'error_cannot_transfer_message',
        severity: 'error',
        alertOpen: true,
      })
    },
  })
}

export const useGetAutoDownloadLimit = () => {
  return useQuery({
    queryKey: ['get', 'autoDownloadLimit'],
    queryFn: async () => {
      const { data } = await axios.get(`/data/auto-download-limit`, { baseURL: apiUrl })
      return data
    },
  })
}

export const useGetConferenceResolution = () => {
  return useQuery({
    queryKey: ['get', 'conferenceResolution'],
    queryFn: async () => {
      const { data } = await axios.get(`/data/conference-resolution`, { baseURL: apiUrl })
      return data
    },
  })
}

interface Content {
  messageId: string
  fileId: string
}

export const GetDownloadedFile = (conversationId: string) => {
  const { axiosInstance } = useAuthContext()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (content: Content) => {
      const cacheKey = `${conversationId}-${content.messageId}-${content.fileId}`
      if (fileCache.has(cacheKey)) {
        return fileCache.get(cacheKey)
      }
      const response = await axiosInstance.get(`/data/${conversationId}/${content.messageId}/${content.fileId}`, {
        responseType: 'blob',
      })
      const blob = response.data
      const blobUrl = URL.createObjectURL(blob)
      fileCache.set(cacheKey, { blob, blobUrl })
      return { blob, blobUrl }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
  })
}

export const useGetDownloadFileInfo = ({ content, conversationId }: { content: Content; conversationId: string }) => {
  const { axiosInstance } = useAuthContext()
  return useQuery({
    queryKey: ['get', 'downloadFileInfo', conversationId, content.messageId, content.fileId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/data/${conversationId}/${content.messageId}/${content.fileId}/is-downloaded`,
        { baseURL: apiUrl },
      )
      return data
    },
    enabled: true,
  })
}
