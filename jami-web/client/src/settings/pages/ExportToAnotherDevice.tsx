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

import { Box, Card, CardContent, CardHeader, TextField, Typography } from '@mui/material'
import {
  AddDeviceStateChanged,
  DeviceAuthError,
  DeviceAuthStateCode,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import BaseButton from '../../components/common/BaseButton.js'
import { AlertSnackbarContext } from '../../contexts/AlertSnackbarProvider.js'
import { useWebSocketContext } from '../../contexts/WebSocketProvider.js'
import {
  useCancelAddDeviceMutation,
  useConfirmAddDeviceMutation,
  useExportAccountMutation,
} from '../../services/accountQueries.js'
import QrReader from '../components/QrReader.js'

export function ExportToAnotherDevice() {
  const { setAlertContent } = use(AlertSnackbarContext)
  const exportAccountMutation = useExportAccountMutation()
  const webSocket = useWebSocketContext()
  const navigate = useNavigate()
  const [opId, setOpId] = useState<number | undefined>()
  const [uri, setUri] = useState<string | undefined>()
  const isSentRef = useRef(false)
  // The daemon reports the operation id asynchronously, so a ref keeps it available to events
  // arriving before the state update has been rendered.
  const opIdRef = useRef<number | undefined>(undefined)
  const [state, setState] = useState(DeviceAuthStateCode.Init)
  const [peerAddress, setPeerAddress] = useState<string | undefined>()

  useEffect(() => {
    function addDeviceStateChangedListener(data: AddDeviceStateChanged) {
      if (!isSentRef.current) {
        // The operation was not started from this page.
        return
      }

      if (opIdRef.current === undefined) {
        opIdRef.current = data.opId
        setOpId(data.opId)
      } else if (opIdRef.current !== data.opId) {
        // not the same operation
        return
      }

      const details = data.details ?? {}

      setState(data.state)
      switch (data.state) {
        case DeviceAuthStateCode.Authenticating:
          // accept or not authentication
          setPeerAddress(details['peer_address'])
          break
        case DeviceAuthStateCode.Done:
          if (details['error'] === DeviceAuthError.Authentication) {
            setAlertContent({
              messageI18nKey: 'device_auth_error_authentication',
              severity: 'error',
              alertOpen: true,
            })
            navigate('/settings/account/linked-devices')
            break
          } else if (details['error'] === DeviceAuthError.Network) {
            setAlertContent({
              messageI18nKey: 'device_auth_error_network',
              severity: 'error',
              alertOpen: true,
            })
            navigate('/settings/account/linked-devices')
            break
          }
          break
        default:
          // should never be reached
          if (data.state !== DeviceAuthStateCode.Connecting && data.state !== DeviceAuthStateCode.InProgress) {
            setAlertContent({
              messageI18nKey: 'unknown_error_alert',
              severity: 'error',
              alertOpen: true,
            })
          }
          break
      }
    }
    webSocket.bind(WebSocketMessageType.AddDeviceStateChanged, addDeviceStateChangedListener)
    return () => {
      webSocket.unbind(WebSocketMessageType.AddDeviceStateChanged, addDeviceStateChangedListener)
    }
  }, [navigate, setAlertContent, webSocket])

  useEffect(() => {
    if (uri && !isSentRef.current) {
      isSentRef.current = true
      exportAccountMutation.mutate(uri)
    }
  }, [uri, exportAccountMutation])

  const exportFailed = exportAccountMutation.isError

  useEffect(() => {
    if (!exportFailed) {
      return
    }
    setAlertContent({
      messageI18nKey: 'link_device_could_not_initiate',
      severity: 'error',
      alertOpen: true,
    })
    navigate('/settings/account/linked-devices')
  }, [exportFailed, navigate, setAlertContent])

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Card sx={{ width: '600px', height: '700px' }}>
        {state === DeviceAuthStateCode.Init && <EnterCode setCode={setUri} />}
        {state === DeviceAuthStateCode.Connecting && <InProgress isConnecting={true} opId={opId} />}
        {state === DeviceAuthStateCode.Authenticating && opId !== undefined && (
          <AcceptLink peerAddress={peerAddress || 'unknown'} opId={opId} />
        )}
        {state === DeviceAuthStateCode.InProgress && <InProgress isConnecting={false} opId={opId} />}
        {state === DeviceAuthStateCode.Done && <ExportDone />}
      </Card>
    </Box>
  )
}

const ExportDone = () => {
  const { t } = useTranslation()
  return (
    <CardHeader
      title={t('export_account')}
      subheader={
        <Box
          sx={{
            marginTop: '200px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography>{t('account_transferred_successfully')}</Typography>
          <Typography>{t('account_transferred_successfully_message')}</Typography>
        </Box>
      }
    />
  )
}

interface InProgressProps {
  isConnecting: boolean
  opId: number | undefined
}

const InProgress = ({ isConnecting, opId }: InProgressProps) => {
  const { t } = useTranslation()
  return (
    <CardHeader
      title={t('export_account')}
      subheader={
        <Box
          sx={{
            marginTop: '200px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          {isConnecting ? (
            <Typography>{t('connecting_to_the_new_device')}</Typography>
          ) : (
            <Typography>{t('account_transfer_in_progress')}</Typography>
          )}
          <Typography>{t('please_wait')}</Typography>
          {opId !== undefined && <CancelExportButton opId={opId} />}
        </Box>
      }
    />
  )
}

interface CancelExportButtonProps {
  opId: number
}

/**
 * Way out of the waiting steps: the daemon may never report the next state, and leaving the page
 * without cancelling strands the operation on the daemon.
 */
const CancelExportButton = ({ opId }: CancelExportButtonProps) => {
  const { t } = useTranslation()
  const cancelMutation = useCancelAddDeviceMutation(opId)

  return (
    <BaseButton variant="outlined" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
      {t('dialog_cancel')}
    </BaseButton>
  )
}

interface AcceptLinkProps {
  peerAddress: string
  opId: number
}

const AcceptLink = ({ peerAddress, opId }: AcceptLinkProps) => {
  const { t } = useTranslation()
  const cancelMutation = useCancelAddDeviceMutation(opId)
  const confirmMutation = useConfirmAddDeviceMutation(opId)

  return (
    <>
      <CardHeader
        title={t('export_account')}
        subheader={
          <Box
            sx={{
              marginTop: '200px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography>{t('new_device_found')}</Typography>
            <Typography>{t('new_device_found_confirmation')}</Typography>
            <Typography sx={{ fontWeight: 'bolder' }}>{t('new_device_found_address') + ' ' + peerAddress}</Typography>
          </Box>
        }
      />
      <CardContent>
        <Box
          sx={{
            marginTop: '50px',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            flexDirection: 'column',
            alignItems: 'center',
            height: '300px',
          }}
        >
          <Box sx={{ display: 'flex', gap: '20px', marginTop: '50px' }}>
            {' '}
            <BaseButton
              variant="contained"
              color="primary"
              onClick={() => {
                confirmMutation.mutate()
              }}
            >
              {t('confirm')}
            </BaseButton>
            <BaseButton
              onClick={() => {
                cancelMutation.mutate()
              }}
              variant="contained"
              color="primary"
            >
              {t('dialog_cancel')}
            </BaseButton>
          </Box>
        </Box>
      </CardContent>
    </>
  )
}

interface EnterCodeProps {
  setCode: (code: string | undefined) => void
}

const EnterCode = ({ setCode }: EnterCodeProps) => {
  const [tmpCode, setTmpCode] = useState('')
  const [isQrCodeSelected, setIsQrCodeSelected] = useState(true)
  const { setAlertContent } = use(AlertSnackbarContext)
  const { t } = useTranslation()

  const handleScannedCode = useCallback(
    (code: string | undefined) => {
      setTmpCode(code ?? '')
      if (!code) {
        return
      }
      if (!code.includes('jami-auth://')) {
        setAlertContent({
          messageI18nKey: 'invalid_code_provided',
          severity: 'error',
          alertOpen: true,
        })
        setTmpCode('')
        return
      }
      setCode(code)
    },
    [setAlertContent, setCode],
  )

  const onCodeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTmpCode(event.target.value)
  }

  const onConnect = () => {
    if (!tmpCode) {
      setAlertContent({
        messageI18nKey: 'invalid_code_provided',
        severity: 'error',
        alertOpen: true,
      })
      return
    }
    if (!tmpCode.includes('jami-auth://')) {
      setAlertContent({
        messageI18nKey: 'invalid_code_provided',
        severity: 'error',
        alertOpen: true,
      })
      setTmpCode('')
    } else {
      setCode(tmpCode)
    }
  }

  const modifyMethodStyles = {
    '&:hover': {
      cursor: 'pointer',
    },
  }

  return (
    <>
      <CardHeader
        title={t('export_account')}
        subheader={
          <Box
            sx={{
              marginTop: '72px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography>{t('export_account_initiate_on_new_device')}</Typography>
            <Typography>{t('export_account_steps')}</Typography>
            <Typography>{t('export_account_scan_qr_when_ready')}</Typography>
          </Box>
        }
      />
      <CardContent>
        <Box
          sx={{
            marginTop: '50px',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            flexDirection: 'column',
            alignItems: 'center',
            height: '300px',
          }}
        >
          {isQrCodeSelected ? (
            <>
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <QrReader setScannedResult={handleScannedCode} />
              </Box>
              <Box
                sx={modifyMethodStyles}
                onClick={() => {
                  setIsQrCodeSelected(false)
                }}
              >
                <Typography>{t('export_account_alternatively_enter_code')}</Typography>
              </Box>
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '20px',
                  marginTop: '100px',
                }}
              >
                <TextField value={tmpCode} onChange={onCodeChange} size="small" />
                <BaseButton onClick={onConnect} variant="contained" color="primary">
                  {t('connect')}
                </BaseButton>
              </Box>

              <Box
                sx={modifyMethodStyles}
                onClick={() => {
                  setIsQrCodeSelected(true)
                }}
              >
                <Typography>{t('export_account_alternatively_scan_qr')}</Typography>
              </Box>
            </>
          )}
        </Box>
      </CardContent>
    </>
  )
}
