/*
 * Copyright (C) 2022-2024 Savoir-faire Linux Inc.
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

import { Box } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { QrScanner, type QrScannerInstance, type QrScanResult } from '../../utils/qrScanner.js'

interface QrReader {
  setScannedResult: (result: string | undefined) => void
}

const QrReader = ({ setScannedResult }: QrReader) => {
  const scannerRef = useRef<QrScannerInstance>(null)
  const videoElementRef = useRef<HTMLVideoElement>(null)
  const qrBoxElementRef = useRef<HTMLDivElement>(null)
  const [qrOn, setQrOn] = useState<boolean>(true)

  const onScanFail = (err: string | Error) => {
    console.log(err)
  }

  useEffect(() => {
    const onScanSuccess = (result: QrScanResult) => {
      setScannedResult(result?.data)
    }

    const videoElement = videoElementRef.current
    if (videoElement && !scannerRef.current) {
      scannerRef.current = new QrScanner(videoElement, onScanSuccess, {
        onDecodeError: onScanFail,
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        overlay: qrBoxElementRef.current || undefined,
        maxScansPerSecond: 1,
        returnDetailedScanResult: true,
      })

      scannerRef.current
        ?.start()
        .then(() => setQrOn(true))
        .catch((err: unknown) => {
          if (err) setQrOn(false)
        })
    }

    if (!videoElement) {
      if (!videoElementRef.current) {
        scannerRef.current?.stop()
      }
    }
  }, [setScannedResult])

  useEffect(() => {
    if (!qrOn) alert('Camera is blocked or not accessible. Please allow camera in your browser permissions and Reload.')
  }, [qrOn])

  return (
    <Box
      sx={{
        width: '230px',
        height: '230px',
        margin: '0 auto',
        position: 'relative',
        borderRadius: '10px',
      }}
    >
      <video
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
        ref={videoElementRef}
      ></video>
    </Box>
  )
}

export default QrReader
