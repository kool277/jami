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
import { WebSocketMessageType } from '../enums/websocket-message-type.js'
import { IConversationRequest } from './conversation.js'
import {
  AccountMessageStatus,
  AddDeviceStateChanged,
  CallExit,
  CallInvite,
  CallJoin,
  ComposingStatus,
  ConversationMemberEvent,
  ConversationMessage,
  ConversationReady,
  ConversationView,
  DeviceAuthStateChanged,
  IAccountDetails,
  IKnownDevicesChanged,
  LoadMoreMessages,
  LoadSwarmUntil,
  NewBuddyNotification,
  ProfileReceived,
  ReactionAdded,
  ReactionRemoved,
  WebRtcIceCandidate,
  WebRtcSdp,
  WithReceiver,
  WithSender,
} from './websocket-interfaces.js'

export interface WebSocketMessageTable {
  [WebSocketMessageType.AccountDetails]: IAccountDetails
  [WebSocketMessageType.ComposingStatus]: ComposingStatus
  [WebSocketMessageType.ConversationMessage]: ConversationMessage
  [WebSocketMessageType.ConversationRequest]: IConversationRequest
  [WebSocketMessageType.ConversationView]: ConversationView
  [WebSocketMessageType.AccountMessageStatus]: AccountMessageStatus
  [WebSocketMessageType.ReactionAdded]: ReactionAdded
  [WebSocketMessageType.ReactionRemoved]: ReactionRemoved
  [WebSocketMessageType.ProfileReceived]: ProfileReceived
  [WebSocketMessageType.MessageEdition]: ConversationMessage
  [WebSocketMessageType.ConversationMemberEvent]: ConversationMemberEvent
  [WebSocketMessageType.LoadMoreMessages]: LoadMoreMessages
  [WebSocketMessageType.DeviceAuthStateChanged]: DeviceAuthStateChanged
  [WebSocketMessageType.AddDeviceStateChanged]: AddDeviceStateChanged
  [WebSocketMessageType.LoadSwarmUntil]: LoadSwarmUntil
  [WebSocketMessageType.KnownDevicesChanged]: IKnownDevicesChanged
  [WebSocketMessageType.ConversationReady]: ConversationReady

  // calls (in the order they should be sent)
  [WebSocketMessageType.sendCallInvite]: CallInvite
  [WebSocketMessageType.onCallInvite]: CallInvite & WithSender
  [WebSocketMessageType.sendCallExit]: CallExit // can be sent any time after invite
  [WebSocketMessageType.onCallExit]: CallExit & WithSender
  [WebSocketMessageType.sendCallJoin]: CallJoin
  [WebSocketMessageType.onCallJoin]: CallJoin & WithSender
  [WebSocketMessageType.sendWebRtcDescription]: WebRtcSdp & WithReceiver
  [WebSocketMessageType.onWebRtcDescription]: WebRtcSdp & WithSender
  [WebSocketMessageType.sendWebRtcIceCandidate]: WebRtcIceCandidate & WithReceiver
  [WebSocketMessageType.onWebRtcIceCandidate]: WebRtcIceCandidate & WithSender

  // Presence
  [WebSocketMessageType.NewBuddyNotification]: NewBuddyNotification
}

export interface WebSocketMessage<T extends WebSocketMessageType> {
  type: T
  data: WebSocketMessageTable[T]
}
