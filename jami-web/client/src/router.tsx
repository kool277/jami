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

import { AdminSettingSelection, AdminWizardState } from '@savoirfairelinux/jami-web-common'
import { lazy } from 'react'
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route } from 'react-router-dom'

import App, { appLoader } from './App.js'
import NavigatePreservingSearch from './components/NavigatePreservingSearch.js'
import RouteErrorBoundary from './components/RouteErrorBoundary.js'
import { AdminConfigurationOptions } from './enums/adminConfigurationOptions.js'
import { AuthenticationMethods } from './enums/authenticationMethods.js'
import { RouteParams } from './hooks/useUrlParams.js'
import { userSettingsPath, userSettingsRoutePaths } from './settings/routes.js'

const loadAdminBundle = () => import('./admin/index.js')
const loadSettingsBundle = () => import('./settings/index.js')
const AccountDetailsListener = lazy(() => import('./components/AccountDetailsListener.js'))
const AccountsOverview = lazy(() => loadAdminBundle().then(({ AccountsOverview }) => ({ default: AccountsOverview })))
const AdminAccountConfiguration = lazy(() =>
  loadAdminBundle().then(({ AdminAccountConfiguration }) => ({ default: AdminAccountConfiguration })),
)
const AdminAuthWrapper = lazy(() => loadAdminBundle().then(({ AdminAuthWrapper }) => ({ default: AdminAuthWrapper })))
const AuthMethods = lazy(() => loadAdminBundle().then(({ AuthMethods }) => ({ default: AuthMethods })))
const ConfigureOpenId = lazy(() => loadAdminBundle().then(({ ConfigureOpenId }) => ({ default: ConfigureOpenId })))
const DownloadLimit = lazy(() => loadAdminBundle().then(({ DownloadLimit }) => ({ default: DownloadLimit })))
const GuestAuthMethod = lazy(() => loadAdminBundle().then(({ GuestAuthMethod }) => ({ default: GuestAuthMethod })))
const JamsAuthMethod = lazy(() => loadAdminBundle().then(({ JamsAuthMethod }) => ({ default: JamsAuthMethod })))
const LocalAuthMethod = lazy(() => loadAdminBundle().then(({ LocalAuthMethod }) => ({ default: LocalAuthMethod })))
const MediaSettings = lazy(() => loadAdminBundle().then(({ MediaSettings }) => ({ default: MediaSettings })))
const OpenIdAuthMethod = lazy(() => loadAdminBundle().then(({ OpenIdAuthMethod }) => ({ default: OpenIdAuthMethod })))
const ConversationView = lazy(() => import('./components/ConversationView.js'))
const NotificationHandler = lazy(() => import('./components/NotificationHandler.js'))
const ActionMessageProvider = lazy(() => import('./contexts/ActionMessageProvider.js'))
//const AuthProvider = lazy(() => import('./contexts/AuthProvider.js'))
import AuthProvider from './contexts/AuthProvider.js'
const CallManagerProvider = lazy(() => import('./contexts/CallManagerProvider.js'))
const ConversationProvider = lazy(() => import('./contexts/ConversationProvider.js'))
const PendingConversationProvider = lazy(() => import('./contexts/PendingConversationProvider.js'))
const ImportDeviceProvider = lazy(() => import('./contexts/ImportDeviceProvider.js'))
const MessengerProvider = lazy(() => import('./contexts/MessengerProvider.js'))
const PresenceProvider = lazy(() => import('./contexts/PresenceProvider.js'))
const UserMediaProvider = lazy(() => import('./contexts/UserMediaProvider.js'))
//const WebSocketLinkProvider = lazy(() => import('./contexts/WebSocketLinkProvider.js'))
//const WebSocketProvider = lazy(() => import('./contexts/WebSocketProvider.js'))
import WebSocketLinkProvider from './contexts/WebSocketLinkProvider.js'
import WebSocketProvider from './contexts/WebSocketProvider.js'
const AccountSettings = lazy(() => loadSettingsBundle().then(({ AccountSettings }) => ({ default: AccountSettings })))
const AppAccessSettings = lazy(() =>
  loadSettingsBundle().then(({ AppAccessSettings }) => ({ default: AppAccessSettings })),
)
const AdminLogin = lazy(() => loadAdminBundle().then(({ AdminLogin }) => ({ default: AdminLogin })))
const AdminPanel = lazy(() => loadAdminBundle().then(({ AdminPanel }) => ({ default: AdminPanel })))
const AdminSettingsIndex = lazy(() =>
  loadAdminBundle().then(({ AdminSettingsIndex }) => ({ default: AdminSettingsIndex })),
)
const AdminConfigureJams = lazy(() =>
  loadAdminBundle().then(({ AdminConfigureJams }) => ({ default: AdminConfigureJams })),
)
const AdminConfigureNameServer = lazy(() =>
  loadAdminBundle().then(({ AdminConfigureNameServer }) => ({ default: AdminConfigureNameServer })),
)
const AdminCreateAccount = lazy(() =>
  loadAdminBundle().then(({ AdminCreateAccount }) => ({ default: AdminCreateAccount })),
)
const CallSettings = lazy(() => loadSettingsBundle().then(({ CallSettings }) => ({ default: CallSettings })))
const CustomizeProfileSettings = lazy(() =>
  loadSettingsBundle().then(({ CustomizeProfileSettings }) => ({ default: CustomizeProfileSettings })),
)
const PasskeysSettings = lazy(() =>
  loadSettingsBundle().then(({ PasskeysSettings }) => ({ default: PasskeysSettings })),
)
const ExportToAnotherDevice = lazy(() =>
  loadSettingsBundle().then(({ ExportToAnotherDevice }) => ({ default: ExportToAnotherDevice })),
)
const GeneralSettings = lazy(() => loadSettingsBundle().then(({ GeneralSettings }) => ({ default: GeneralSettings })))
const LinkedDevicesPage = lazy(() =>
  loadSettingsBundle().then(({ LinkedDevicesPage }) => ({ default: LinkedDevicesPage })),
)
const ImportAccount = lazy(() => import('./pages/LinkExistingDevice/ImportAccount.js'))
const ImportAccountConfirmation = lazy(() => import('./pages/LinkExistingDevice/ImportAccountConfirmation.js'))
const ImportAccountConnecting = lazy(() => import('./pages/LinkExistingDevice/ImportAccountConnecting.js'))
const ImportAccountLock = lazy(() => import('./pages/LinkExistingDevice/ImportAccountLock.js'))
const ImportAccountTransferInProgress = lazy(
  () => import('./pages/LinkExistingDevice/ImportAccountTransferInProgress.js'),
)
const Contacts = lazy(() => import('./pages/Contacts.js'))
const InviteDetail = lazy(() => import('./components/InviteDetail.js'))
const Invites = lazy(() => import('./pages/Invites.js'))
const Login = lazy(() => import('./pages/Login.js'))
const Messenger = lazy(() => import('./pages/Messenger.js'))
const NotFound = lazy(() => import('./pages/NotFound.js'))
const Registration = lazy(() => import('./pages/Registration.js'))
const Settings = lazy(() => import('./pages/Settings.js'))
const SettingsIndex = lazy(() =>
  import('./pages/Settings.js').then(({ SettingsIndex }) => ({ default: SettingsIndex })),
)

export type ConversationRouteParams = RouteParams<{ conversationId?: string }, Record<string, never>>
export type PendingConversationRouteParams = RouteParams<{ contactUri?: string }, Record<string, never>>

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route path="/" element={<App />} errorElement={<RouteErrorBoundary />} loader={appLoader}>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <WebSocketLinkProvider>
            <ImportDeviceProvider>
              <Outlet />
            </ImportDeviceProvider>
          </WebSocketLinkProvider>
        }
      >
        <Route path="import-account" element={<ImportAccount />} />
        <Route path="import-account-connecting" element={<ImportAccountConnecting />} />
        <Route path="import-account-unlock" element={<ImportAccountLock />} />
        <Route path="import-account-done" element={<ImportAccountConfirmation />} />
        <Route path="import-account-in-progress" element={<ImportAccountTransferInProgress />} />
      </Route>
      <Route path="register" element={<Registration />} />
      <Route path="admin" element={<Navigate to={'/admin/login'} />} />
      <Route path="admin/login" element={<AdminLogin />} />
      <Route
        element={
          <AdminAuthWrapper>
            <AdminPanel>
              <Outlet />
            </AdminPanel>
          </AdminAuthWrapper>
        }
      >
        <Route path="admin/settings" element={<AdminSettingsIndex />} />
        <Route
          path={`/admin/${AdminSettingSelection.CONFIGURATION}`}
          element={
            <Navigate
              to={`/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.ACCOUNT}`}
              replace
            />
          }
        />
        <Route path={`/admin/${AdminSettingSelection.ACCOUNTS}`} element={<AccountsOverview />} />
        <Route path={`/admin/${AdminSettingSelection.AUTHENTICATION}`} element={<AuthMethods />} />
        <Route
          path={`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.JAMI}`}
          element={<LocalAuthMethod />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.JAMS}`}
          element={<JamsAuthMethod />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.GUEST}`}
          element={<GuestAuthMethod />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.OPENID}`}
          element={<OpenIdAuthMethod />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.AUTHENTICATION}/${AuthenticationMethods.OPENID}/:provider`}
          element={<ConfigureOpenId />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.ACCOUNT}`}
          element={<AdminAccountConfiguration />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.AUTO_DOWNLOAD_LIMIT}`}
          element={<DownloadLimit />}
        />
        <Route
          path={`/admin/${AdminSettingSelection.CONFIGURATION}/${AdminConfigurationOptions.MEDIA}`}
          element={<MediaSettings />}
        />
      </Route>
      <Route path="admin/setup" element={<Outlet />}>
        <Route index element={<Navigate to={'/admin/setup/account'} />} />
        <Route path={AdminWizardState.account} element={<AdminCreateAccount />} />
        <Route path={AdminWizardState.local} element={<AdminConfigureNameServer />} />
        <Route path={AdminWizardState.jams} element={<AdminConfigureJams />} />
      </Route>

      <Route
        element={
          <AuthProvider>
            <WebSocketProvider>
              <PresenceProvider>
                <AccountDetailsListener>
                  <UserMediaProvider>
                    <CallManagerProvider>
                      <Outlet />
                    </CallManagerProvider>
                  </UserMediaProvider>
                </AccountDetailsListener>
              </PresenceProvider>
            </WebSocketProvider>
          </AuthProvider>
        }
      >
        <Route
          element={
            <MessengerProvider>
              <NotificationHandler>
                <Outlet />
              </NotificationHandler>
            </MessengerProvider>
          }
        >
          <Route index element={<Navigate to="/conversation" replace />} />
          <Route path="conversation" element={<Messenger />}>
            <Route
              path="new/:contactUri"
              element={
                <ActionMessageProvider>
                  <PendingConversationProvider>
                    <ConversationView />
                  </PendingConversationProvider>
                </ActionMessageProvider>
              }
            />
            <Route
              path=":conversationId"
              element={
                <ActionMessageProvider>
                  <ConversationProvider>
                    <ConversationView />
                  </ConversationProvider>
                </ActionMessageProvider>
              }
            />
          </Route>
          <Route path="invites" element={<Invites />}>
            <Route path=":conversationId" element={<InviteDetail />} />
          </Route>
          <Route path="settings" element={<Settings />}>
            <Route index element={<SettingsIndex />} />
            <Route
              path={userSettingsRoutePaths.general}
              element={<NavigatePreservingSearch to={userSettingsPath(userSettingsRoutePaths.generalSystem)} replace />}
            />
            <Route path={userSettingsRoutePaths.generalSystem} element={<GeneralSettings section="system" />} />
            <Route path={userSettingsRoutePaths.generalAppearance} element={<GeneralSettings section="appearance" />} />
            <Route path={userSettingsRoutePaths.generalChat} element={<GeneralSettings section="chat" />} />
            <Route path={userSettingsRoutePaths.manageAccount} element={<AccountSettings />} />
            <Route path={userSettingsRoutePaths.customizeProfile} element={<CustomizeProfileSettings />} />
            <Route path={userSettingsRoutePaths.passkeys} element={<PasskeysSettings />} />
            <Route path={userSettingsRoutePaths.appAccess} element={<AppAccessSettings />} />
            <Route path={userSettingsRoutePaths.calls} element={<CallSettings />} />
            <Route path={userSettingsRoutePaths.linkedDevices} element={<LinkedDevicesPage />} />
            <Route path={userSettingsRoutePaths.exportDevice} element={<ExportToAnotherDevice />} />
          </Route>
          <Route path="contacts" element={<Contacts />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Route>,
  ),
)
