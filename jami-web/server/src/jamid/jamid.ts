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
import {
  JamiSignal,
  type JamiSwig,
  loadNativeModule,
  type StringMap,
  stringMapToRecord,
  stringVectToArray,
  vectMapToRecordArray,
} from '@savoirfairelinux/jami-core'
import {
  AccountDetails,
  AccountMessageStatus,
  ComposingStatus,
  ContactDetails,
  ConversationInfos,
  ConversationMemberEventCode,
  ConversationMessage,
  ConversationPreferences,
  DataTransferError,
  DeviceAuthStateCode,
  DeviceRevocationState,
  Devices,
  LookupResult,
  Message,
  Reaction,
  RegisteredNameFoundState,
  VolatileDetails,
  WebSocketMessage,
  WebSocketMessageType,
} from '@savoirfairelinux/jami-web-common'
import fs from 'fs'
import log from 'loglevel'
import os from 'os'
import path from 'path'
import { filter, firstValueFrom, map, Subject } from 'rxjs'
import { Service } from 'typedi'

import { AdminAccount } from '../storage/admin-account.js'
import { toStringRecord } from '../utils/string-record.js'
import { cacheProfile, clearAvatarCache, decodeVCard, getAvatar, getDisplayName } from '../utils/vCard.js'
import { WebSocketServer } from '../websocket/websocket-server.js'
import { ConversationMemberInfos } from './conversation-member-infos.js'
import { ConversationRequestMetadata } from './conversation-request-metadata.js'
import {
  AccountDetailsChanged,
  AccountMessageStatusChanged,
  AccountProfileReceived,
  AddDeviceStateChanged,
  ClearCache,
  ComposingStatusChanged,
  ContactAdded,
  ContactRemoved,
  ConversationLoaded,
  ConversationMemberEvent,
  ConversationReady,
  ConversationRemoved,
  ConversationRequestReceived,
  DataTransferEvent,
  DeviceAuthStateChanged,
  DeviceRevocationEnded,
  IncomingAccountMessage,
  INearbyPeerNotification,
  INewBuddyNotification,
  INewServerSubscriptionRequest,
  IServerError,
  ISubscriptionStateChanged,
  KnownDevicesChanged,
  MessageFound,
  NameRegistrationEnded,
  ProfileReceived,
  ReactionAdded,
  ReactionRemoved,
  RegisteredNameFound,
  RegistrationStateChanged,
  SwarmLoaded,
  SwarmMessageReceived,
  SwarmMessageUpdated,
  UserSearchEnded,
  VolatileDetailsChanged,
} from './jami-signal-interfaces.js'
import { DataTransferEventCode, MessageState, NameRegistrationEndedState, RegistrationState } from './state-enums.js'

const LIBJAMI_FLAG_DEBUG = 1 << 0
const LIBJAMI_FLAG_NO_LOCAL_AUDIO = 1 << 6
const LIBJAMI_FLAG_NO_LOCAL_VIDEO = 1 << 7
const LIBJAMI_FLAG_NO_LOCAL_MEDIA = LIBJAMI_FLAG_NO_LOCAL_AUDIO | LIBJAMI_FLAG_NO_LOCAL_VIDEO

type JamiSwigWithInitOptions = Omit<JamiSwig, 'init'> & {
  init(args: Record<string, unknown>, options?: { flags?: number }): void
}

@Service()
export class Jamid {
  private jamiSwig: JamiSwigWithInitOptions
  private usernamesToAccountIds = new Map<string, string>()
  private accountUrisToAccountIds = new Map<string, string>()
  readonly events

  reformatMessage(message: Message): Message {
    return {
      id: message.id,
      author: message.body.author,
      linearizedParent: message.linearizedParent,
      parents: message.body.parents,
      timestamp: message.body.timestamp ? Number(message.body.timestamp) : 0,
      duration: message.body.duration,
      displayName: message.body.displayName,
      sha3sum: message.body.sha3sum,
      tid: message.body.tid,
      totalSize: message.body.totalSize,
      fileId: message.body.fileId,
      type: message.body.type,
      'reply-to': message.body['reply-to'],
      action: message.body.action,
      editions: message.editions,
      reactions: message.reactions,
      status: message.status,
      body: message.body.body,
    }
  }

  constructor(
    private webSocketServer: WebSocketServer,
    private adminAccount: AdminAccount,
  ) {
    this.jamiSwig = loadNativeModule() as JamiSwigWithInitOptions

    // Setup signal handlers
    const handlers: Record<string, unknown> = {}

    // Add default handler for all signals
    const createDefaultHandler = (signal: string) => {
      return (...args: unknown[]) => log.warn('Unhandled', signal, args)
    }
    for (const signal in JamiSignal) {
      handlers[signal] = createDefaultHandler(signal)
    }

    // Overwrite handlers for handled signals using RxJS Subjects, converting multiple arguments to objects
    const onClearCache = new Subject<ClearCache>()
    handlers.ClearCache = (accountId: string, conversationId: string) =>
      onClearCache.next({ accountId, conversationId })

    const onAccountsChanged = new Subject<void>()
    handlers.AccountsChanged = () => onAccountsChanged.next()

    const onAccountDetailsChanged = new Subject<AccountDetailsChanged>()
    handlers.AccountDetailsChanged = (accountId: string, details: AccountDetails) =>
      onAccountDetailsChanged.next({ accountId, details })

    const onAccountProfileReceived = new Subject<AccountProfileReceived>()
    handlers.AccountProfileReceived = (accountId: string, displayName: string, photo: string) =>
      onAccountProfileReceived.next({ accountId, displayName, photo })

    const onAddDeviceStateChanged = new Subject<AddDeviceStateChanged>()
    handlers.AddDeviceStateChanged = (accountId: string, opId: number, state: number, details: Map<string, string>) =>
      onAddDeviceStateChanged.next({ accountId, opId, state, details })

    const onDeviceAuthStateChanged = new Subject<DeviceAuthStateChanged>()
    handlers.DeviceAuthStateChanged = (accountId: string, state: number, details: Map<string, string>) =>
      onDeviceAuthStateChanged.next({ accountId, state, details })

    const onVolatileDetailsChanged = new Subject<VolatileDetailsChanged>()
    handlers.VolatileDetailsChanged = (accountId: string, details: VolatileDetails) =>
      onVolatileDetailsChanged.next({ accountId, details })

    const onRegistrationStateChanged = new Subject<RegistrationStateChanged>()
    handlers.RegistrationStateChanged = (accountId: string, state: RegistrationState, code: number, details: string) =>
      onRegistrationStateChanged.next({ accountId, state, code, details })

    const onNameRegistrationEnded = new Subject<NameRegistrationEnded>()
    handlers.NameRegistrationEnded = (accountId: string, state: NameRegistrationEndedState, username: string) =>
      onNameRegistrationEnded.next({ accountId, state, username })

    const onRegisteredNameFound = new Subject<RegisteredNameFound>()
    handlers.RegisteredNameFound = (
      accountId: string,
      query: string,
      state: RegisteredNameFoundState,
      address: string,
      name: string,
    ) => onRegisteredNameFound.next({ accountId, query, state, address, name })

    const onKnownDevicesChanged = new Subject<KnownDevicesChanged>()
    handlers.KnownDevicesChanged = (accountId: string, devices: Devices) =>
      onKnownDevicesChanged.next({ accountId, devices })

    const onIncomingAccountMessage = new Subject<IncomingAccountMessage>()
    handlers.IncomingAccountMessage = (accountId: string, from: string, payload: Record<string, string>) =>
      onIncomingAccountMessage.next({ accountId, from, payload })

    const onAccountMessageStatusChanged = new Subject<AccountMessageStatusChanged>()
    handlers.AccountMessageStatusChanged = (
      accountId: string,
      messageId: string,
      peer: string,
      state: MessageState,
      conversationId: string,
    ) => onAccountMessageStatusChanged.next({ accountId, messageId, peer, state, conversationId })

    const onContactAdded = new Subject<ContactAdded>()
    handlers.ContactAdded = (accountId: string, contactId: string, confirmed: boolean) =>
      onContactAdded.next({ accountId, contactId, confirmed })

    const onContactRemoved = new Subject<ContactRemoved>()
    handlers.ContactRemoved = (accountId: string, contactId: string, banned: boolean) =>
      onContactRemoved.next({ accountId, contactId, banned })

    const onConversationRequestReceived = new Subject<ConversationRequestReceived>()
    handlers.ConversationRequestReceived = (
      accountId: string,
      conversationId: string,
      metadata: ConversationRequestMetadata,
    ) => onConversationRequestReceived.next({ accountId, conversationId, metadata })

    // This signal can fire in bulk during account teardown.
    // Handle it explicitly so it does not go through the default warn-level "Unhandled" logger.
    handlers.ConversationRequestDeclined = (accountId: string, conversationId: string) => {
      log.debug('ConversationRequestDeclined', { accountId, conversationId })
    }

    const onConversationReady = new Subject<ConversationReady>()
    handlers.ConversationReady = (accountId: string, conversationId: string) =>
      onConversationReady.next({ accountId, conversationId })

    const onConversationRemoved = new Subject<ConversationRemoved>()
    handlers.ConversationRemoved = (accountId: string, conversationId: string) =>
      onConversationRemoved.next({ accountId, conversationId })

    const onConversationLoaded = new Subject<ConversationLoaded>()
    handlers.ConversationLoaded = (id: number, accountId: string, conversationId: string, messages: Message[]) =>
      onConversationLoaded.next({ id, accountId, conversationId, messages })

    const onProfileReceived = new Subject<ProfileReceived>()
    handlers.ProfileReceived = (accountId: string, from: string, path: string) =>
      onProfileReceived.next({ accountId, from, path })

    const onSwarmLoaded = new Subject<SwarmLoaded>()
    handlers.SwarmLoaded = (id: number, accountId: string, conversationId: string, messages: Message[]) => {
      messages = messages.map((message) => this.reformatMessage(message))
      onSwarmLoaded.next({ id, accountId, conversationId, messages })
    }

    const onConversationMemberEvent = new Subject<ConversationMemberEvent>()
    handlers.ConversationMemberEvent = (
      accountId: string,
      conversationId: string,
      memberUri: string,
      event: ConversationMemberEventCode,
    ) => {
      onConversationMemberEvent.next({ accountId, conversationId, memberUri, event })
    }

    const onDataTransferEvent = new Subject<DataTransferEvent>()
    handlers.DataTransferEvent = (
      accountId: string,
      conversationId: string,
      interactionId: string,
      fileId: string,
      eventCode: number,
    ) => onDataTransferEvent.next({ accountId, conversationId, interactionId, fileId, eventCode })

    const onSwarmMessageReceived = new Subject<SwarmMessageReceived>()
    handlers.SwarmMessageReceived = (accountId: string, conversationId: string, message: Message) => {
      message = this.reformatMessage(message)
      onSwarmMessageReceived.next({ accountId, conversationId, message })
    }

    const onSwarmMessageUpdated = new Subject<SwarmMessageUpdated>()
    handlers.SwarmMessageUpdated = (accountId: string, conversationId: string, message: Message) => {
      message = this.reformatMessage(message)
      onSwarmMessageUpdated.next({ accountId, conversationId, message })
    }

    const onMessageFound = new Subject<MessageFound>()
    handlers.MessagesFound = (id: number, accountId: string, conversationId: string, messages: Message[]) => {
      onMessageFound.next({
        id,
        accountId,
        conversationId,
        messages,
      })
    }

    const onReactionAdded = new Subject<ReactionAdded>()
    handlers.ReactionAdded = (accountId: string, conversationId: string, messageId: string, reaction: Reaction) =>
      onReactionAdded.next({ accountId, conversationId, messageId, reaction })

    const onReactionRemoved = new Subject<ReactionRemoved>()
    handlers.ReactionRemoved = (accountId: string, conversationId: string, messageId: string, reactionId: string) =>
      onReactionRemoved.next({ accountId, conversationId, messageId, reactionId })

    const onComposingStatusChanged = new Subject<ComposingStatusChanged>()
    handlers.ComposingStatusChanged = (accountId: string, conversationId: string, from: string, status: number) =>
      onComposingStatusChanged.next({ accountId, conversationId, from, status })

    const onUserSearchEnded = new Subject<UserSearchEnded>()
    handlers.UserSearchEnded = (
      accountId: string,
      state: RegisteredNameFoundState,
      query: string,
      results: Record<string, string>,
    ) => {
      onUserSearchEnded.next({ accountId, state, query, results })
    }
    const onDeviceRevocationEnded = new Subject<DeviceRevocationEnded>()
    handlers.DeviceRevocationEnded = (accountId: string, device: string, state: DeviceRevocationState) =>
      onDeviceRevocationEnded.next({ accountId, device, state })

    const onSubscriptionStateChanged = new Subject<ISubscriptionStateChanged>()
    handlers.SubscriptionStateChanged = (accountId: string, buddyUri: string, state: number) =>
      onSubscriptionStateChanged.next({ accountId, buddyUri, state })

    const onNearbyPeerNotification = new Subject<INearbyPeerNotification>()
    handlers.NearbyPeerNotification = (accountId: string, buddyUri: string, state: number, displayName: string) =>
      onNearbyPeerNotification.next({ accountId, buddyUri, state, displayName })

    const onNewBuddyNotification = new Subject<INewBuddyNotification>()
    handlers.NewBuddyNotification = (accountId: string, buddyUri: string, status: number, lineStatus: string) =>
      onNewBuddyNotification.next({ accountId, buddyUri, status, lineStatus })

    const onNewServerSubscriptionRequest = new Subject<INewServerSubscriptionRequest>()
    handlers.NewServerSubscriptionRequest = (remote: string) => onNewServerSubscriptionRequest.next({ remote })

    const onServerError = new Subject<IServerError>()
    handlers.ServerError = (accountId: string, error: string, msg: string) =>
      onServerError.next({ accountId, error, msg })

    // Expose all signals in an events object to allow other handlers to subscribe after jamiSwig.init()
    this.events = {
      onAccountsChanged: onAccountsChanged.asObservable(),
      onAccountDetailsChanged: onAccountDetailsChanged.asObservable(),
      onAccountProfileReceived: onAccountProfileReceived.asObservable(),
      onAddDeviceStateChanged: onAddDeviceStateChanged.asObservable(),
      onDeviceAuthStateChanged: onDeviceAuthStateChanged.asObservable(),
      onVolatileDetailsChanged: onVolatileDetailsChanged.asObservable(),
      onRegistrationStateChanged: onRegistrationStateChanged.asObservable(),
      onNameRegistrationEnded: onNameRegistrationEnded.asObservable(),
      onRegisteredNameFound: onRegisteredNameFound.asObservable(),
      onKnownDevicesChanged: onKnownDevicesChanged.asObservable(),
      onIncomingAccountMessage: onIncomingAccountMessage.asObservable(),
      onAccountMessageStatusChanged: onAccountMessageStatusChanged.asObservable(),
      onClearCache: onClearCache.asObservable(),
      onContactAdded: onContactAdded.asObservable(),
      onContactRemoved: onContactRemoved.asObservable(),
      onConversationRequestReceived: onConversationRequestReceived.asObservable(),
      onConversationReady: onConversationReady.asObservable(),
      onConversationRemoved: onConversationRemoved.asObservable(),
      onConversationLoaded: onConversationLoaded.asObservable(),
      onDataTransferEvent: onDataTransferEvent.asObservable(),
      onSwarmLoaded: onSwarmLoaded.asObservable(),
      onConversationMemberEvent: onConversationMemberEvent.asObservable(),
      onSwarmMessageReceived: onSwarmMessageReceived.asObservable(),
      onSwarmMessageUpdated: onSwarmMessageUpdated.asObservable(),
      onComposingStatusChanged: onComposingStatusChanged.asObservable(),
      onReactionAdded: onReactionAdded.asObservable(),
      onReactionRemoved: onReactionRemoved.asObservable(),
      onProfileReceived: onProfileReceived.asObservable(),
      onUserSearchEnded: onUserSearchEnded.asObservable(),
      onDeviceRevocationEnded: onDeviceRevocationEnded.asObservable(),
      onMessageFound: onMessageFound.asObservable(),
      onSubscriptionStateChanged: onSubscriptionStateChanged.asObservable(),
      onNearbyPeerNotification: onNearbyPeerNotification.asObservable(),
      onNewBuddyNotification: onNewBuddyNotification.asObservable(),
      onNewServerSubscriptionRequest: onNewServerSubscriptionRequest.asObservable(),
      onServerError: onServerError.asObservable(),
    }

    this.setupSignalHandlers()

    if (process.env.JAMI_WEB_MONITOR === 'true') {
      this.jamiSwig.monitor(true)
    }

    // RxJS Subjects are used as signal handlers for the following reasons:
    // 1. You cannot change event handlers after calling jamiSwig.init()
    // 2. You cannot specify multiple handlers for the same event
    // 3. You cannot specify a default handler
    this.jamiSwig.init(handlers, { flags: this.getInitFlags() })
  }

  private getInitFlags(): number {
    let flags = LIBJAMI_FLAG_DEBUG
    if (this.adminAccount.getConfig().noLocalMediaEnabled) {
      flags |= LIBJAMI_FLAG_NO_LOCAL_MEDIA
    }
    return flags
  }

  stop(): void {
    this.jamiSwig.fini()
  }

  startConversation(accountId: string): string {
    return this.jamiSwig.startConversation(accountId)
  }

  getVolatileAccountDetails(accountId: string): VolatileDetails {
    return stringMapToRecord(this.jamiSwig.getVolatileAccountDetails(accountId)) as unknown as VolatileDetails
  }

  getAccountDetails(accountId: string): AccountDetails {
    return stringMapToRecord(this.jamiSwig.getAccountDetails(accountId)) as unknown as AccountDetails
  }

  updateProfile(
    accountId: string,
    displayName: string,
    avatarPath: string,
    fileType: string,
    botOwner: string,
    flag: number,
  ): void {
    this.jamiSwig.updateProfile(accountId, displayName, avatarPath, fileType, botOwner, flag)
  }

  setAccountDetails(accountId: string, accountDetails: AccountDetails): void {
    const accountDetailsStringMap: StringMap = new this.jamiSwig.StringMap()
    for (const [key, value] of Object.entries(accountDetails)) {
      accountDetailsStringMap.set(key, value)
    }
    this.jamiSwig.setAccountDetails(accountId, accountDetailsStringMap)
  }

  async addAccount(accountDetails: Partial<AccountDetails>): Promise<RegistrationStateChanged> {
    accountDetails['Account.type'] = 'RING'

    const accountDetailsStringMap: StringMap = new this.jamiSwig.StringMap()
    for (const [key, value] of Object.entries(accountDetails)) {
      accountDetailsStringMap.set(key, value.toString())
    }
    const accountId = this.jamiSwig.addAccount(accountDetailsStringMap)
    return firstValueFrom(
      this.events.onRegistrationStateChanged.pipe(
        filter((value) => value.accountId === accountId),
        filter(
          (value) => value.state === RegistrationState.Registered || value.state === RegistrationState.ErrorGeneric,
        ),
      ),
    )
  }

  addDevice(accountId: string, uri: string): void {
    this.jamiSwig.addDevice(accountId, uri)
  }

  confirmDevice(accountId: string, opId: number): void {
    this.jamiSwig.confirmAddDevice(accountId, opId)
  }

  cancelDevice(accountId: string, opId: number): void {
    this.jamiSwig.cancelAddDevice(accountId, opId)
  }

  async getLinkToken(): Promise<DeviceAuthStateChanged> {
    const accountDetailsStringMap: StringMap = new this.jamiSwig.StringMap()
    accountDetailsStringMap.set('Account.archiveURL', 'jami-auth')
    accountDetailsStringMap.set('Account.type', 'RING')

    const accountId = this.jamiSwig.addAccount(accountDetailsStringMap)
    // Subscribe before yielding: the daemon delivers signals on the main thread,
    // so nothing can be emitted until this synchronous block returns.
    return firstValueFrom(
      this.events.onDeviceAuthStateChanged.pipe(
        filter((value) => value.accountId === accountId),
        filter((value) => value.state === DeviceAuthStateCode.TokenAvailable),
      ),
    )
  }

  removeAccount(accountId: string): void {
    this.jamiSwig.removeAccount(accountId)
  }

  getAccountIds(): string[] {
    return stringVectToArray(this.jamiSwig.getAccountList())
  }

  sendAccountTextMessage(accountId: string, contactId: string, message: string): void {
    const messageStringMap: StringMap = new this.jamiSwig.StringMap()
    messageStringMap.set('application/json', message)
    this.jamiSwig.sendAccountTextMessage(accountId, contactId, messageStringMap, 0)
  }

  async lookupUsername(username: string, nameserver: string, accountId?: string): Promise<LookupResult> {
    const hasRingNs = this.jamiSwig.lookupName(accountId || '', nameserver, username)
    if (!hasRingNs) {
      throw new Error(
        'Account ' + accountId + ': Error looking up username: ' + username + ' with nameserver: ' + nameserver,
      )
    }

    const data = firstValueFrom(this.events.onRegisteredNameFound.pipe(filter((value) => value.query === username)))
    return data
  }

  async lookupAddress(address: string, nameserver: string, accountId?: string): Promise<LookupResult> {
    if (address === undefined) {
      throw new Error('Address is undefined')
    }
    const hasRingNs = this.jamiSwig.lookupAddress(accountId || '', nameserver, address)

    if (!hasRingNs) {
      throw new Error(accountId + ': Error looking up address: ' + address + ' with nameserver: ' + nameserver)
    }

    const data = await firstValueFrom(
      this.events.onRegisteredNameFound.pipe(filter((value) => value.query === address)),
    )
    return data
  }

  async registerUsername(accountId: string, username: string, password: string): Promise<NameRegistrationEndedState> {
    const hasRingNs = this.jamiSwig.registerName(accountId, username, 'password', password)
    if (!hasRingNs) {
      throw new Error(accountId + ': Error registering username: ' + username)
    }
    return firstValueFrom(
      this.events.onNameRegistrationEnded.pipe(
        filter((value) => value.accountId === accountId),
        map((value) => value.state),
      ),
    )
  }

  async searchUser(accountId: string, username: string) {
    const hasRingNs = this.jamiSwig.searchUser(accountId, username)
    if (!hasRingNs) {
      throw new Error(accountId + ': Error searching user: ' + username)
    }
    return firstValueFrom(this.events.onUserSearchEnded.pipe(filter((value) => value.accountId === accountId)))
  }

  clearCache(accountId: string, conversationId: string): void {
    this.jamiSwig.clearCache(accountId, conversationId)
  }

  getDevices(accountId: string): Devices {
    const devices = stringMapToRecord(this.jamiSwig.getKnownRingDevices(accountId))
    return devices
  }

  revokeDevice(accountId: string, deviceId: string, scheme: string = 'password', password: string = '') {
    const isOk = this.jamiSwig.revokeDevice(accountId, deviceId, scheme, password)

    if (!isOk) {
      log.error(`Error revoking device: accountId=${accountId}, deviceId=${deviceId}`)
      throw new Error(accountId + ': Error revoking device: ' + deviceId)
    }

    return firstValueFrom(
      this.events.onDeviceRevocationEnded.pipe(
        filter((value) => value.accountId === accountId),
        filter((value) => value.device === deviceId),
      ),
    )
  }

  addContact(accountId: string, contactId: string): void {
    this.jamiSwig.addContact(accountId, contactId)
  }

  sendTrustRequest(accountId: string, contactId: string): void {
    this.jamiSwig.sendTrustRequest(accountId, contactId, new this.jamiSwig.Blob())
  }

  removeContact(accountId: string, contactId: string): void {
    this.jamiSwig.removeContact(accountId, contactId, false)
  }

  blockContact(accountId: string, contactId: string): void {
    this.jamiSwig.removeContact(accountId, contactId, true)
  }

  getContacts(accountId: string): ContactDetails[] {
    return vectMapToRecordArray(this.jamiSwig.getContacts(accountId)) as unknown as ContactDetails[]
  }

  getContactDetails(accountId: string, contactId: string): ContactDetails {
    return stringMapToRecord(this.jamiSwig.getContactDetails(accountId, contactId)) as unknown as ContactDetails
  }

  getDefaultModeratorUris(accountId: string): string[] {
    return stringVectToArray(this.jamiSwig.getDefaultModerators(accountId))
  }

  addDefaultModerator(accountId: string, contactId: string): void {
    this.jamiSwig.setDefaultModerator(accountId, contactId, true)
  }

  removeDefaultModerator(accountId: string, contactId: string): void {
    this.jamiSwig.setDefaultModerator(accountId, contactId, false)
  }

  getConversationIds(accountId: string): string[] {
    return stringVectToArray(this.jamiSwig.getConversations(accountId))
  }

  getConversationInfos(accountId: string, conversationId: string): ConversationInfos {
    return stringMapToRecord(this.jamiSwig.conversationInfos(accountId, conversationId)) as unknown as ConversationInfos
  }

  async getAllFiles(accountId: string, conversationId: string): Promise<Message[]> {
    const searchId = this.jamiSwig.searchConversation(
      accountId,
      conversationId,
      '',
      '',
      '',
      'application/data-transfer+json',
      0,
      0,
      0,
      0,
    )

    return firstValueFrom(
      this.events.onMessageFound.pipe(
        filter((value) => value.id === Number(searchId)),
        map((value) => value.messages),
      ),
    )
  }

  getConversationMembers(accountId: string, conversationId: string): ConversationMemberInfos[] {
    return vectMapToRecordArray(
      this.jamiSwig.getConversationMembers(accountId, conversationId),
    ) as unknown as ConversationMemberInfos[]
  }

  addConversationMember(accountId: string, conversationId: string, uri: string): void {
    this.jamiSwig.addConversationMember(accountId, conversationId, uri)
  }

  removeConversationMember(accountId: string, conversationId: string, uri: string): void {
    this.jamiSwig.removeConversationMember(accountId, conversationId, uri)
  }

  getConversationPreferences(accountId: string, conversationId: string): ConversationPreferences {
    return stringMapToRecord(
      this.jamiSwig.getConversationPreferences(accountId, conversationId),
    ) as unknown as ConversationPreferences
  }

  setConversationPreferences(accountId: string, conversationId: string, preferences: ConversationPreferences): void {
    const preferencesStringMap: StringMap = new this.jamiSwig.StringMap()
    for (const [key, value] of Object.entries(preferences)) {
      preferencesStringMap.set(key, value.toString())
    }
    this.jamiSwig.setConversationPreferences(accountId, conversationId, preferencesStringMap)
  }

  updateConversationInfos(accountId: string, conversationId: string, infos: ConversationInfos): void {
    const infosStringMap: StringMap = new this.jamiSwig.StringMap()
    for (const [key, value] of Object.entries(infos)) {
      infosStringMap.set(key, value.toString())
    }
    this.jamiSwig.updateConversationInfos(accountId, conversationId, infosStringMap)
  }

  provideAccountAuthentication(accountId: string, credentials: string, scheme: string): boolean {
    return this.jamiSwig.provideAccountAuthentication(accountId, credentials, scheme)
  }

  async getConversationMessages(
    accountId: string,
    conversationId: string,
    fromMessage = '',
    n = 32,
  ): Promise<Message[]> {
    const requestId = this.jamiSwig.loadConversationMessages(accountId, conversationId, fromMessage, n)
    if (requestId === 0) {
      return []
    }
    return firstValueFrom(
      this.events.onConversationLoaded.pipe(
        filter((value) => value.id === requestId),
        map((value) => value.messages),
      ),
    )
  }

  async getSwarmMessages(accountId: string, conversationId: string, fromMessage = '', n = 8): Promise<Message[]> {
    const requestId = this.jamiSwig.loadConversation(accountId, conversationId, fromMessage, n)
    if (requestId === 0) {
      return []
    }
    return firstValueFrom(
      this.events.onSwarmLoaded.pipe(
        filter((value) => value.id === requestId),
        map((value) => value.messages),
      ),
    )
  }

  async waitForVolatileDetails(accountId: string): Promise<VolatileDetails> {
    return firstValueFrom(
      this.events.onVolatileDetailsChanged.pipe(
        filter((value) => value.accountId === accountId),
        map((value) => value.details),
      ),
    )
  }

  async loadSwarmUntil(
    accountId: string,
    conversationId: string,
    fromMessage: string,
    toMessage: string,
  ): Promise<Message[]> {
    const requestId = this.jamiSwig.loadSwarmUntil(accountId, conversationId, fromMessage, toMessage)
    if (requestId === 0) {
      return []
    }
    return firstValueFrom(
      this.events.onSwarmLoaded.pipe(
        filter((value) => value.id === requestId),
        map((value) => value.messages),
      ),
    )
  }

  removeConversation(accountId: string, conversationId: string) {
    this.jamiSwig.removeConversation(accountId, conversationId)
  }

  getConversationRequests(accountId: string): ConversationRequestMetadata[] {
    return vectMapToRecordArray(
      this.jamiSwig.getConversationRequests(accountId),
    ) as unknown as ConversationRequestMetadata[]
  }

  acceptConversationRequest(accountId: string, conversationId: string): Promise<ConversationReady> {
    this.jamiSwig.acceptConversationRequest(accountId, conversationId)
    return firstValueFrom(
      this.events.onConversationReady.pipe(
        filter((value) => value.accountId === accountId),
        filter((value) => value.conversationId === conversationId),
      ),
    )
  }

  declineConversationRequest(accountId: string, conversationId: string): void {
    this.jamiSwig.declineConversationRequest(accountId, conversationId)
  }

  sendConversationMessage(
    accountId: string,
    conversationId: string,
    message: string,
    replyTo?: string,
    flag?: number,
  ): void {
    this.jamiSwig.sendMessage(accountId, conversationId, message, replyTo ?? '', flag ?? 0)
  }

  transferMessage(accountId: string, conversationId: string, message: string): void {
    this.jamiSwig.sendMessage(accountId, conversationId, message, '', 0)
  }

  deleteConversationMessage(accountId: string, conversationId: string, messageId: string): void {
    this.jamiSwig.sendMessage(accountId, conversationId, '', messageId, 1)
  }

  setIsComposing(accountId: string, conversationId: string, isWriting: boolean) {
    this.jamiSwig.setIsComposing(accountId, conversationId, isWriting)
  }

  setMessageDisplayed(accountId: string, conversationId: string, messageId: string, status: number): boolean {
    return this.jamiSwig.setMessageDisplayed(accountId, conversationId, messageId, status)
  }

  getCallIds(accountId: string): string[] {
    return stringVectToArray(this.jamiSwig.getCallList(accountId))
  }

  // TODO: Replace Record with interface
  getCallDetails(accountId: string, callId: string): Record<string, string> {
    return stringMapToRecord(this.jamiSwig.getCallDetails(accountId, callId))
  }

  getAccountIdFromUsername(username: string): string | undefined {
    return this.usernamesToAccountIds.get(username.toLowerCase())
  }

  // File transfer
  sendFile(accountId: string, conversationId: string, path: string, displayName: string, replyTo: string): void {
    this.jamiSwig.sendFile(accountId, conversationId, path, displayName, replyTo)
  }

  downloadFile(accountId: string, conversationId: string, interactionId: string, fileId: string, path: string): number {
    return this.jamiSwig.downloadFile(accountId, conversationId, interactionId, fileId, path)
  }

  cancelDataTransfer(accountId: string, conversationId: string, fileId: string): DataTransferError {
    return this.jamiSwig.cancelDataTransfer(accountId, conversationId, fileId)
  }

  getFileTransferInfo(
    accountId: string,
    conversationId: string,
    fileId: string,
    pathOut: string,
    totalOut: number,
    progressOut: number,
  ): DataTransferError {
    return this.jamiSwig.fileTransferInfo(accountId, conversationId, fileId, pathOut, totalOut, progressOut)
  }

  async waitForDataTransferEvent(
    accountId: string,
    conversationId: string,
    interactionId: string,
    fileId: string,
  ): Promise<DataTransferEvent> {
    return firstValueFrom(
      this.events.onDataTransferEvent.pipe(
        filter(
          (event) =>
            event.accountId === accountId &&
            event.conversationId === conversationId &&
            event.interactionId === interactionId &&
            event.fileId === fileId,
        ),
      ),
    )
  }

  isUriAlreadyImported(accountId: string): boolean {
    return this.accountUrisToAccountIds.has(accountId)
  }

  publish(accountId: string, status: boolean, note: string): void {
    this.jamiSwig.publish(accountId, status, note)
  }

  answerServerRequest(uri: string, flag: boolean) {
    this.jamiSwig.answerServerRequest(uri, flag)
  }

  // false to stop tracking, true to start tracking
  subscribeBuddy(accountId: string, uri: string, flag: boolean): void {
    this.jamiSwig.subscribeBuddy(accountId, uri, flag)
  }

  getSubscriptions(accountId: string) {
    return vectMapToRecordArray(this.jamiSwig.getSubscriptions(accountId))
  }

  setSubscriptions(accountId: string, uris: string[]): void {
    this.jamiSwig.setSubscriptions(accountId, uris)
  }

  private setupSignalHandlers(): void {
    this.events.onSubscriptionStateChanged.subscribe((signal) => {
      log.debug('Received SubscriptionStateChanged:', JSON.stringify(signal))
    })

    this.events.onNearbyPeerNotification.subscribe((signal) => {
      log.debug('Received NearbyPeerNotification:', JSON.stringify(signal))
    })

    this.events.onNewBuddyNotification.subscribe((signal) => {
      log.debug('Received NewBuddyNotification:', JSON.stringify(signal))
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.NewBuddyNotification, signal)
    })

    this.events.onNewServerSubscriptionRequest.subscribe((signal) => {
      log.debug('Received NewServerSubscriptionRequest:', JSON.stringify(signal))
    })

    this.events.onServerError.subscribe((signal) => {
      log.debug('Received ServerError:', JSON.stringify(signal))
    })

    this.events.onDataTransferEvent.subscribe((signal) => {
      log.debug('Received DataTransferEvent:', JSON.stringify(signal))

      if (signal.eventCode === DataTransferEventCode.created) {
        // It is now safe to delete the associated file
        // in fileId we have the path to the file that we provided
        // to the sendFile function
        const filePath = path.resolve(signal.fileId)

        if (filePath.includes('.local/share/jami/')) {
          // do not remove cache files
          // these are not tmp files
          return
        }
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    })

    this.events.onDeviceRevocationEnded.subscribe((signal) => {
      log.debug('Received DeviceRevocationEnded:', JSON.stringify(signal))
    })

    this.events.onAccountsChanged.subscribe(() => {
      log.debug('Received AccountsChanged')
    })

    this.events.onAccountDetailsChanged.subscribe((signal) => {
      log.debug('Received AccountsDetailsChanged', JSON.stringify(signal))
      const data = {
        details: signal.details,
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.AccountDetails, data)
    })

    this.events.onAccountProfileReceived.subscribe((signal) => {
      log.debug('\nReceived AccountProfileReceived\n', JSON.stringify(signal))
    })

    this.events.onAddDeviceStateChanged.subscribe((signal) => {
      log.debug('\n\nReceived AddDeviceStateChanged:\n\n', JSON.stringify(signal))
      const data = {
        opId: signal.opId,
        state: signal.state,
        details: toStringRecord(signal.details),
      }

      this.webSocketServer.send(signal.accountId, WebSocketMessageType.AddDeviceStateChanged, data)
    })

    this.events.onDeviceAuthStateChanged.subscribe((signal) => {
      log.debug('Received DeviceAuthStateChanged:', JSON.stringify(signal))

      const data = {
        accountId: signal.accountId,
        state: signal.state,
        details: toStringRecord(signal.details),
      }

      this.webSocketServer.send(signal.accountId, WebSocketMessageType.DeviceAuthStateChanged, data)
    })

    this.events.onVolatileDetailsChanged.subscribe(({ accountId, details }) => {
      const username = details['Account.registeredName']
      log.debug(
        `Received VolatileDetailsChanged: {"accountId":"${accountId}",` +
          `"details":{"Account.registeredName":"${username}", ...}}`,
      )

      if (username && username !== 'undefined') {
        // Keep map of usernames to account IDs
        this.usernamesToAccountIds.set(username.toLowerCase(), accountId)
      }

      // The daemon thread that emitted this signal is blocked until the callback
      // returns, and it still holds the account lock that getAccountDetails needs.
      // Querying it from here deadlocks the daemon and the Node main thread against
      // each other, so wait until the callback has unwound.
      setImmediate(() => {
        const uri = this.getAccountDetails(accountId)['Account.username']
        if (!this.accountUrisToAccountIds.has(uri)) {
          this.accountUrisToAccountIds.set(uri, accountId)
        }
      })
    })

    this.events.onRegistrationStateChanged.subscribe((signal) => {
      log.debug('Received RegistrationStateChanged:', JSON.stringify(signal))
    })

    this.events.onNameRegistrationEnded.subscribe((signal) => {
      log.debug('Received NameRegistrationEnded:', JSON.stringify(signal))
    })

    this.events.onRegisteredNameFound.subscribe((signal) => {
      log.debug('Received RegisteredNameFound:', JSON.stringify(signal))
    })

    this.events.onKnownDevicesChanged.subscribe((signal) => {
      log.debug(`Received KnownDevicesChanged: {"accountId":"${signal.accountId}", "devices": ...}`)
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.KnownDevicesChanged, { devices: signal.devices })
    })

    this.events.onIncomingAccountMessage.subscribe(<T extends WebSocketMessageType>(signal: IncomingAccountMessage) => {
      log.debug('Received IncomingAccountMessage:', JSON.stringify(signal))

      const message: Partial<WebSocketMessage<T>> = JSON.parse(signal.payload['application/json'])

      if (typeof message !== 'object' || message === null) {
        log.warn('Account message is not an object')
        return
      }

      if (message.type === undefined || message.data === undefined) {
        log.warn('Account message is not a valid WebSocketMessage (missing type or data fields)')
        return
      }

      if (!Object.values(WebSocketMessageType).includes(message.type)) {
        log.warn(`Invalid WebSocket message type: ${message.type}`)
        return
      }

      this.webSocketServer.send(signal.accountId, message.type, message.data)
    })

    this.events.onAccountMessageStatusChanged.subscribe((signal) => {
      log.debug('Received AccountMessageStatusChanged:', JSON.stringify(signal))
      const data: AccountMessageStatus = {
        conversationId: signal.conversationId,
        peer: signal.peer,
        messageId: signal.messageId,
        status: Number(signal.state),
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.AccountMessageStatus, data)
    })

    this.events.onContactAdded.subscribe((signal) => {
      log.debug('Received ContactAdded:', JSON.stringify(signal))
    })

    this.events.onContactRemoved.subscribe((signal) => {
      log.debug('Received ContactRemoved:', JSON.stringify(signal))
    })

    this.events.onConversationRequestReceived.subscribe((signal) => {
      log.debug('Received ConversationRequestReceived:', JSON.stringify(signal))
      //this.webSocketServer.send(signal.accountId, WebSocketMessageType.ConversationRequest, data);
    })

    this.events.onConversationReady.subscribe((signal) => {
      log.debug('Received ConversationReady:', JSON.stringify(signal))
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.ConversationReady, {
        conversationId: signal.conversationId,
      })
    })

    this.events.onConversationRemoved.subscribe((signal) => {
      log.debug('Received ConversationRemoved:', JSON.stringify(signal))
    })

    this.events.onConversationLoaded.subscribe(({ id, accountId, conversationId }) => {
      log.debug(
        `Received ConversationLoaded: {"id":"${id}","accountId":"${accountId}",` +
          `"conversationId":"${conversationId}"}`,
      )
    })

    this.events.onSwarmLoaded.subscribe(({ id, accountId, conversationId }) => {
      log.debug(
        `Received SwarmLoaded: {"id":"${id}","accountId":"${accountId}",` + `"conversationId":"${conversationId}"}`,
      )
    })

    this.events.onConversationMemberEvent.subscribe((signal) => {
      log.debug('Received onConversationMemberEvent:', JSON.stringify(signal))
      const data = {
        conversationId: signal.conversationId,
        member: signal.memberUri,
        event: signal.event,
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.ConversationMemberEvent, data)
    })

    this.events.onSwarmMessageReceived.subscribe((signal) => {
      log.debug('Received SwarmMessageReceived:', JSON.stringify(signal))
      const data: ConversationMessage = {
        conversationId: signal.conversationId,
        message: signal.message,
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.ConversationMessage, data)
    })

    this.events.onSwarmMessageUpdated.subscribe((signal) => {
      log.debug('Received SwarmMessageUpdated:', JSON.stringify(signal))
      const data: ConversationMessage = {
        conversationId: signal.conversationId,
        message: signal.message,
      }
      // if message was a file and it is deleted we need to delete it from the cache
      if (
        Array.isArray(data.message.editions) &&
        data.message.type === 'application/data-transfer+json' &&
        data.message.fileId === ''
      ) {
        if (data.message.editions.length === 0) {
          console.error('Editions array is empty')
        } else {
          const fileName = data.message.editions[data.message.editions.length - 1].fileId
          if (fileName === undefined) {
            console.error('FileId is undefined')
          } else {
            const filePath = path.join(
              os.homedir(),
              '.local',
              'share',
              'jami',
              signal.accountId,
              'conversation_data',
              signal.conversationId,
              fileName,
            )
            try {
              fs.unlinkSync(filePath)
            } catch (error) {
              console.error('Error deleting file:', error)
            }
          }
        }
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.MessageEdition, data)
    })

    this.events.onReactionAdded.subscribe((signal) => {
      log.debug('Received Reaction Added ' + JSON.stringify(signal))
      const data: ReactionAdded = {
        accountId: signal.accountId,
        conversationId: signal.conversationId,
        messageId: signal.messageId,
        reaction: signal.reaction,
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.ReactionAdded, data)
    })

    this.events.onReactionRemoved.subscribe((signal) => {
      log.debug('Received Reaction Removed  ' + JSON.stringify(signal))
      const data: ReactionRemoved = {
        accountId: signal.accountId,
        conversationId: signal.conversationId,
        messageId: signal.messageId,
        reactionId: signal.reactionId,
      }
      this.webSocketServer.send(signal.accountId, WebSocketMessageType.ReactionRemoved, data)
    })

    this.events.onProfileReceived.subscribe(async (signal) => {
      log.debug('Received ProfileReceived:', JSON.stringify(signal))
      const peer = signal.from
      const accountId = signal.accountId
      await clearAvatarCache(accountId, peer)
      const profile = await decodeVCard(signal.path)
      if (profile) {
        await cacheProfile(accountId, peer, profile)
      } else {
        await getAvatar(accountId, peer)
      }
      const displayName = profile?.name || (await getDisplayName(accountId, peer))

      this.webSocketServer.send(accountId, WebSocketMessageType.ProfileReceived, { peer, displayName })
    })

    this.events.onComposingStatusChanged.subscribe((signal) => {
      log.debug('Received ComposingStatusChanged:', JSON.stringify(signal))
      const data: ComposingStatus = {
        contactId: signal.from,
        conversationId: signal.conversationId,
        isWriting: signal.status === 1,
      }

      this.webSocketServer.send(signal.accountId, WebSocketMessageType.ComposingStatus, data)
    })

    this.events.onUserSearchEnded.subscribe((signal) => {
      log.debug('Received UserSearchEnded:', JSON.stringify(signal))
    })
  }
}
