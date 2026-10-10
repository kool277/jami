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
export enum WebSocketMessageType {
  AccountDetails = 'account-details',
  ConversationMessage = 'conversation-message',
  ConversationRequest = 'conversation-request',
  ConversationView = 'conversation-view',
  ComposingStatus = 'composing-status',
  ConversationMemberEvent = 'conversation-member-event',
  AccountMessageStatus = 'account-message-status',
  ReactionAdded = 'reaction-added',
  ReactionRemoved = 'reaction-removed',
  ProfileReceived = 'profile-received',
  MessageEdition = 'message-edition',
  LoadMoreMessages = 'load-more-messages',
  DeviceAuthStateChanged = 'device-auth-state-changed',
  AddDeviceStateChanged = 'add-device-state-changed',
  LoadSwarmUntil = 'load-swarm-until',
  KnownDevicesChanged = 'known-devices-changed',
  ConversationReady = 'conversation-ready',

  // calls (in the order they should be sent)
  sendCallInvite = 'sendCallInvite',
  onCallInvite = 'onCallInvite',
  sendCallExit = 'sendCallExit', // can be sent anytime after invite
  onCallExit = 'onCallExit',
  sendCallJoin = 'sendCallJoin',
  onCallJoin = 'onCallJoin',
  sendWebRtcDescription = 'sendWebRtcDescription',
  onWebRtcDescription = 'onWebRtcDescription',
  sendWebRtcIceCandidate = 'sendWebRtcIceCandidate',
  onWebRtcIceCandidate = 'onWebRtcIceCandidate',

  // Presence
  NewBuddyNotification = 'new-buddy-notification',
}
