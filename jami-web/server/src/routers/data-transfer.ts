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
import { DataTransferEventCode, HttpStatusCode } from '@savoirfairelinux/jami-web-common'
import { Router } from 'express'
import asyncHandler from 'express-async-handler'
import fs from 'fs'
import multer from 'multer'
import os from 'os'
import path from 'path'
import { Container } from 'typedi'

import { Jamid } from '../jamid/jamid.js'
import { authenticateToken, requireApiTokenScope } from '../middleware/auth.js'
import { extendIfGuest } from '../middleware/guest.js'
import { AdminAccount } from '../storage/admin-account.js'
import { resolveConversationDataFilePath } from '../utils/conversation-data-path.js'
const config = Container.get(AdminAccount)

const multerPath = config.getUploadPath()
if (!fs.existsSync(multerPath)) {
  fs.mkdirSync(multerPath)
}

function parseName(name: string) {
  let fileName = name.replace('\\', '_')
  fileName = fileName.replace('/', '_')
  fileName = fileName.replace("'", '_')
  fileName = fileName.replace('"', '_')
  return fileName
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const accountId = req.res?.locals.accountId
    const userFilePath = multerPath + accountId + '/'
    if (!fs.existsSync(userFilePath)) {
      fs.mkdirSync(userFilePath)
    }
    cb(null, userFilePath)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const extension = parseName(file.originalname.split('.').pop() || '')
    const filename = file.fieldname + '-' + uniqueSuffix + '.' + extension
    cb(null, filename)
  },
})

const upload = multer({ storage: storage })
const jamid = Container.get(Jamid)
export const dataTransferRouter = Router()

function getConversationDataDirectory(accountId: string): string {
  return path.join(os.homedir(), '.local', 'share', 'jami', accountId, 'conversation_data')
}

function getConversationDataFilePath(
  conversationDataDirectory: string,
  conversationId: string,
  fileId: string,
): string | undefined {
  return resolveConversationDataFilePath(conversationDataDirectory, conversationId, fileId)
}

dataTransferRouter.get('/auto-download-limit', (req, res) => {
  res.status(HttpStatusCode.Ok).json({ limit: config.getAutoDownloadLimit() })
})

dataTransferRouter.get('/conference-resolution', (req, res) => {
  res.status(HttpStatusCode.Ok).json({ resolution: config.getConfig().conferenceResolution })
})

dataTransferRouter.use(authenticateToken)
dataTransferRouter.use(extendIfGuest)
dataTransferRouter.use(requireApiTokenScope('files'))

dataTransferRouter.post('/transfer-file', (req, res) => {
  const accountId = res.locals.accountId
  const targetedConversations = req.body.targetedConversations
  const comment = req.body.comment
  const conversationId = req.body.conversationId
  const fileId = req.body.fileId
  const fileName = req.body.fileName

  const conversationDataDirectory = getConversationDataDirectory(accountId)
  const filePath = getConversationDataFilePath(conversationDataDirectory, conversationId, fileId)
  if (!filePath) {
    return res.status(HttpStatusCode.BadRequest).send('Invalid file path')
  }

  if (!fs.existsSync(filePath)) {
    res.status(HttpStatusCode.NotFound).send('File not found')
    console.error('file not found : ', filePath)
    return
  }

  for (const targetConversationId of targetedConversations) {
    jamid.sendFile(accountId, targetConversationId, filePath, fileName, '')
    if (comment) {
      jamid.sendConversationMessage(accountId, targetConversationId, comment)
    }
  }

  res.status(HttpStatusCode.Ok).send()
})

dataTransferRouter.post(
  '/:conversationId',
  upload.array('file'),
  asyncHandler<{ conversationId: string }>(async (req, res) => {
    const accountId = res.locals.accountId
    const conversationId = req.params.conversationId

    const replyTo = req.body.replyTo
    for (const file of req.files as Express.Multer.File[]) {
      // the file is temporarily stored in the server
      // for now the files are stored in the uploads folder (automatically created)
      // we don t know when the file will be downloaded from the client
      // when it happens the file will be stored in the uploads folder and
      // in /home/<username>/.local/share/jami/:accountId/conversation_data/:conversationId/:fileId
      // which can be concerning if the file is too big
      // the service isnt a cloud service so we need to remove files after a certain time
      const updatedFileName = parseName(file.originalname)
      const path = multerPath + accountId + '/' + file.filename
      jamid.sendFile(accountId, conversationId, path, updatedFileName, replyTo)
    }
    res.status(HttpStatusCode.Ok).send()
  }),
)

dataTransferRouter.get('/:conversationId/:interactionId/:fileId', async (req, res) => {
  const accountId = res.locals.accountId
  const conversationId = req.params.conversationId
  const interactionId = req.params.interactionId
  const fileId = req.params.fileId
  const downloadPathOnServer = ''
  const acceptedAudioTypes = ['ogg', 'wav', 'mpeg', 'mp4', 'aac', 'flac']
  const acceptedImageTypes = ['apng', 'avif', 'jpg', 'JPG', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff']

  const conversationDataDirectory = getConversationDataDirectory(accountId)
  const filePath = getConversationDataFilePath(conversationDataDirectory, conversationId, fileId)
  if (!filePath) {
    return res.status(HttpStatusCode.BadRequest).send('Invalid file path')
  }

  if (fs.existsSync(filePath)) {
    const extension = filePath.split('.').pop() || ''

    if (acceptedAudioTypes.includes(extension)) {
      res.setHeader('Content-Type', 'audio/' + extension)
    } else if (acceptedImageTypes.includes(extension)) {
      res.setHeader('Content-Type', 'image/' + extension)
    }

    return res.sendFile(
      path.relative(conversationDataDirectory, filePath),
      { root: conversationDataDirectory },
      (err) => {
        if (err) {
          console.error('Error sending file:', err)
          return res.status(HttpStatusCode.InternalServerError).send('Error sending file')
        }
      },
    )
  }

  const status = jamid.downloadFile(accountId, conversationId, interactionId, fileId, downloadPathOnServer)

  if (status === 0) {
    return res.status(HttpStatusCode.NotFound).send('File not found')
  }

  let code = await jamid.waitForDataTransferEvent(accountId, conversationId, interactionId, fileId)

  const errors = [
    DataTransferEventCode.invalid,
    DataTransferEventCode.unsupported,
    DataTransferEventCode.invalid_pathname,
    DataTransferEventCode.unjoinable_peer,
    DataTransferEventCode.timeout_expired,
    DataTransferEventCode.closed_by_host,
    DataTransferEventCode.closed_by_peer,
  ]

  if (errors.includes(code.eventCode)) {
    console.error('Error code:', code)
    return res.status(HttpStatusCode.NotFound).send('Error ' + DataTransferEventCode[code.eventCode])
  }

  while (code.eventCode !== DataTransferEventCode.finished) {
    code = await jamid.waitForDataTransferEvent(accountId, conversationId, interactionId, fileId)
    if (errors.includes(code.eventCode)) {
      console.error('Error code:', code)
      return res.status(HttpStatusCode.NotFound).send('Error ' + DataTransferEventCode[code.eventCode])
    }
  }

  const downloadedFilePath = getConversationDataFilePath(conversationDataDirectory, conversationId, fileId)
  if (!downloadedFilePath) {
    return res.status(HttpStatusCode.BadRequest).send('Invalid file path')
  }

  const extension = downloadedFilePath.split('.').pop() || ''
  if (acceptedAudioTypes.includes(extension)) {
    res.setHeader('Content-Type', 'audio/' + extension)
  } else if (acceptedImageTypes.includes(extension)) {
    res.setHeader('Content-Type', 'image/' + extension)
  }
  return res.sendFile(
    path.relative(conversationDataDirectory, downloadedFilePath),
    { root: conversationDataDirectory },
    (err) => {
      if (err) {
        console.error('Error sending file:', err)
        return res.status(HttpStatusCode.InternalServerError).send('Error sending file')
      }
    },
  )
})

dataTransferRouter.get('/:conversationId/:interactionId/:fileId/is-downloaded', (req, res) => {
  const accountId = res.locals.accountId
  const conversationId = req.params.conversationId
  const fileId = req.params.fileId
  const conversationDataDirectory = getConversationDataDirectory(accountId)
  const filePath = getConversationDataFilePath(conversationDataDirectory, conversationId, fileId)
  if (!filePath) {
    return res.status(HttpStatusCode.BadRequest).send('Invalid file path')
  }

  if (fs.existsSync(filePath)) {
    res.send(true)
    return
  }

  res.send(false)
})
