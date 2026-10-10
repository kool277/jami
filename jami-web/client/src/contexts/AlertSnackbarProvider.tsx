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
import { Alert, AlertColor, AlertProps, AlertTitle, Snackbar, SnackbarProps } from '@mui/material'
import { createContext, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SetState, WithChildren } from '../utils/utils.js'
type AlertSnackbarProps = AlertProps & {
  severity: AlertColor
  open?: boolean
  snackBarProps?: Partial<SnackbarProps>
}

export type AlertContent = {
  messageI18nKey: AlertMessageKeys
  messageI18nContext?: object
  severity: AlertColor
  alertOpen: boolean
}

export function AlertSnackbar({ severity, open, snackBarProps, children, ...alertProps }: AlertSnackbarProps) {
  const { t } = useTranslation()

  return (
    <Snackbar
      open={open}
      autoHideDuration={3000}
      {...snackBarProps}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'center',
        ...snackBarProps?.anchorOrigin,
      }}
    >
      <Alert severity={severity} {...alertProps}>
        <AlertTitle>{t('severity', { context: `${severity}` })}</AlertTitle>
        {children}
      </Alert>
    </Snackbar>
  )
}

type IAlertSnackbarContext = {
  alertContent: AlertContent
  setAlertContent: SetState<AlertContent>
  closeAlert: () => void
}

const defaultAlertSnackbarContext: IAlertSnackbarContext = {
  alertContent: {
    messageI18nKey: '',
    messageI18nContext: {},
    severity: 'info',
    alertOpen: false,
  },
  setAlertContent: () => {},
  closeAlert: () => {},
}

//Don't forget to add the cases in the switch statement below
type AlertMessageKeys =
  | 'account_switch_error'
  | 'copied_to_clipboard'
  | 'redirect_admin_setup_complete'
  | 'password_input_helper_text_not_match'
  | 'admin_page_setup_not_complete'
  | 'admin_page_setup_complete'
  | 'missed_incoming_call'
  | 'unknown_error_alert'
  | 'username_input_helper_text_empty'
  | 'password_input_helper_text_empty'
  | 'password_input_helper_text_too_short'
  | 'login_invalid_credentials'
  | 'registration_success'
  | 'incorrect_password'
  | 'admin_password_changed_successfully'
  | 'account_password_changed_successfully'
  | 'setting_jams_server_error'
  | 'setting_jams_server_error_same_value'
  | ''
  | 'setting_name_server_error'
  | 'getting_name_server_error'
  | 'setting_jams_server_success'
  | 'removing_jams_server_success'
  | 'removing_jams_server_error'
  | 'unauthorized_access'
  | 'setting_display_name_success_alert'
  | 'setting_display_name_error_alert'
  | 'resetting_display_name_success_alert'
  | 'resetting_display_name_error_alert'
  | 'error_cannot_delete_message'
  | 'error_cannot_transfer_message'
  | 'message_content_copied'
  | 'add_to_group_no_user_selected'
  | 'removed_linked_device_success'
  | 'removed_linked_device_error'
  | 'same_limit_error'
  | 'limit_cannot_be_negative'
  | 'setting_auto_download_limit_success'
  | 'setting_auto_download_limit_error'
  | 'setting_conference_resolution_success'
  | 'setting_conference_resolution_error'
  | 'update_conversation_preferences_error'
  | 'invalid_code_provided'
  | 'device_auth_error_authentication'
  | 'device_auth_error_network'
  | 'auth_error_while_linking_device'
  | 'password_setter_request_failed'
  | 'password_setter_request_failed_not_found'
  | 'link_device_could_not_initiate'
  | 'extending_session_success_alert'
  | 'extending_session_error_alert'
  | 'getting_oauth_clients_error'
  | 'getting_oauth_provider_info_error'
  | 'file_not_downloaded'
  | 'too_many_requests'
  | 'ouath_provider_updated_success'
  | 'passkey_register_success'
  | 'passkey_register_error'
  | 'passkey_login_error'
  | 'passkey_delete_success'
  | 'passkey_delete_error'

export const AlertSnackbarContext = createContext<IAlertSnackbarContext>(defaultAlertSnackbarContext)

const AlertSnackbarProvider = ({ children }: WithChildren) => {
  const { t } = useTranslation()
  const [alertContent, setAlertContent] = useState<AlertContent>(defaultAlertSnackbarContext.alertContent)
  const closeAlert = () => {
    setAlertContent((prev) => {
      return {
        ...prev,
        alertOpen: false,
      }
    })
  }

  //This is to explicitly let i18n know that these keys should be extracted
  const getAlertMessageText = useCallback(
    (messageI18nKey: AlertMessageKeys, messageI18nContext?: object): string => {
      switch (messageI18nKey) {
        case 'account_switch_error':
          return t('account_switch_error')
        case 'missed_incoming_call':
          return t('missed_incoming_call', { ...messageI18nContext })
        case 'unknown_error_alert':
          return t('unknown_error_alert')
        case 'username_input_helper_text_empty':
          return t('username_input_helper_text_empty')
        case 'password_input_helper_text_empty':
          return t('password_input_helper_text_empty')
        case 'password_input_helper_text_too_short':
          return t('password_input_helper_text_too_short')
        case 'login_invalid_credentials':
          return t('login_invalid_credentials')
        case 'registration_success':
          return t('registration_success')
        case 'redirect_admin_setup_complete':
          return t('redirect_admin_setup_complete')
        case 'password_input_helper_text_not_match':
          return t('password_input_helper_text_not_match')
        case 'admin_page_setup_not_complete':
          return t('admin_page_setup_not_complete')
        case 'admin_page_setup_complete':
          return t('admin_page_setup_complete')
        case 'incorrect_password':
          return t('incorrect_password')
        case 'admin_password_changed_successfully':
          return t('admin_password_changed_successfully')
        case 'account_password_changed_successfully':
          return t('account_password_changed_successfully')
        case 'setting_jams_server_error':
          return t('setting_jams_server_error')
        case 'setting_name_server_error':
          return t('setting_name_server_error')
        case 'getting_name_server_error':
          return t('getting_name_server_error')
        case 'copied_to_clipboard':
          return t('copied_to_clipboard')
        case 'setting_jams_server_success':
          return t('setting_jams_server_success')
        case 'unauthorized_access':
          return t('unauthorized_access')
        case 'setting_display_name_success_alert':
          return t('setting_display_name_success_alert')
        case 'setting_display_name_error_alert':
          return t('setting_display_name_error_alert')
        case 'resetting_display_name_success_alert':
          return t('resetting_display_name_success_alert')
        case 'resetting_display_name_error_alert':
          return t('resetting_display_name_error_alert')
        case 'error_cannot_delete_message':
          return t('error_cannot_delete_message')
        case 'error_cannot_transfer_message':
          return t('error_cannot_transfer_message')
        case 'setting_jams_server_error_same_value':
          return t('setting_jams_server_error_same_value')
        case 'removing_jams_server_success':
          return t('removing_jams_server_success')
        case 'removing_jams_server_error':
          return t('removing_jams_server_error')
        case 'message_content_copied':
          return t('message_content_copied')
        case 'add_to_group_no_user_selected':
          return t('add_to_group_no_user_selected')
        case 'removed_linked_device_success':
          return t('removed_linked_device_success')
        case 'removed_linked_device_error':
          return t('removed_linked_device_error')
        case 'same_limit_error':
          return t('same_limit_error')
        case 'limit_cannot_be_negative':
          return t('limit_cannot_be_negative')
        case 'setting_auto_download_limit_success':
          return t('setting_auto_download_limit_success')
        case 'setting_auto_download_limit_error':
          return t('setting_auto_download_limit_error')
        case 'setting_conference_resolution_success':
          return t('setting_conference_resolution_success')
        case 'setting_conference_resolution_error':
          return t('setting_conference_resolution_error')
        case 'update_conversation_preferences_error':
          return t('update_conversation_preferences_error')
        case 'invalid_code_provided':
          return t('invalid_code_provided')
        case 'device_auth_error_authentication':
          return t('device_auth_error_authentication')
        case 'device_auth_error_network':
          return t('device_auth_error_network')
        case 'auth_error_while_linking_device':
          return t('auth_error_while_linking_device')
        case 'password_setter_request_failed':
          return t('password_setter_request_failed')
        case 'password_setter_request_failed_not_found':
          return t('password_setter_request_failed_not_found')
        case 'link_device_could_not_initiate':
          return t('link_device_could_not_initiate')
        case t('extending_session_success_alert'):
          return t('extending_session_success_alert')
        case t('extending_session_error_alert'):
          return t('extending_session_error_alert')
        case 'getting_oauth_clients_error':
          return t('getting_oauth_clients_error')
        case 'getting_oauth_provider_info_error':
          return t('getting_oauth_provider_info_error')
        case 'file_not_downloaded':
          return t('file_not_downloaded')
        case 'too_many_requests':
          return t('too_many_requests')
        case 'ouath_provider_updated_success':
          return t('ouath_provider_updated_success')
        case 'passkey_register_success':
          return t('passkey_register_success')
        case 'passkey_register_error':
          return t('passkey_register_error')
        case 'passkey_login_error':
          return t('passkey_login_error')
        case 'passkey_delete_success':
          return t('passkey_delete_success')
        case 'passkey_delete_error':
          return t('passkey_delete_error')
        default:
          return t('unknown_error_alert')
      }
    },
    [t],
  )

  const value = {
    alertContent,
    setAlertContent,
    closeAlert,
  }

  return (
    <>
      <AlertSnackbar severity={alertContent.severity} open={alertContent.alertOpen} onClose={closeAlert}>
        {getAlertMessageText(alertContent.messageI18nKey, alertContent.messageI18nContext)}
      </AlertSnackbar>
      <AlertSnackbarContext value={value}>{children}</AlertSnackbarContext>
    </>
  )
}

export default AlertSnackbarProvider
