# Calls between the web client and the native clients

The web client calls with the browser's WebRTC (ICE, DTLS-SRTP), signaled
through Jami account messages. The desktop, Android and iOS clients call
with the daemon's own protocol (SIP over Jami channels, SDES-SRTP keys, two
ICE components per stream). Neither side understood the other: a web user
never rang on a native device or the reverse, and a group call in a
conversation with both kinds of members split into two calls that never met.

Since kool277/jami-daemon branch `kool277/webrtc-calls` and kool277/jami-web
branch `kool277/native-calls` (2026-10-24), the daemon speaks the browser's
WebRTC itself: browsers and native devices exchange media directly, end to
end encrypted, and the jami-web server carries no media.

## Wire protocol (the web client's, unchanged)

Account message, MIME `application/json`, payload `{"type": T, "data": D}`:

| T | D | sent to |
|---|---|---|
| onCallInvite | conversationId, withVideoOn, sessionId?, senderId, sentAt?, native?, hosted?, trickleIce? | every member |
| onCallJoin | conversationId, sessionId?, senderId, trickleIce? | every member |
| onCallExit | conversationId, sessionId?, senderId | every member |
| onWebRtcDescription | conversationId, sessionId?, sdp {type, sdp}, senderId, trickleIce? | one member |
| onWebRtcIceCandidate | conversationId, sessionId?, candidate, senderId | one member |

The daemon sends invites, joins and exits to each device of a member, and
descriptions to the device of the peer's session (see Reliability).

A web call is a mesh: whoever is in the call connects to each member who
joins (sends it an offer); a member who answers dials nobody and answers the
offers it gets. Colliding offers follow WebRTC "perfect negotiation": the
side with the smaller account URI rolls back and answers.

New fields: `sentAt` (when the inviter's server sent the invite; older than
2 minutes, it was delivered late and does not ring), `native` (an invite
from a daemon: other daemons ignore it, the SIP call rings their devices),
`hosted` (a group call that a native device hosts), `trickleIce: false`
(the daemon reads candidates only in descriptions, so a browser waits for
ICE gathering, up to 5 s, before it sends one).

## In the daemon

- `WebRtcCall` (`src/sip/webrtccall.{h,cpp}`) is a `SIPCall` whose leg to a
  browser uses the WebRTC SDP (`src/sip/webrtc_sdp.{h,cpp}`), one ICE
  transport per m-line with rtcp-mux, DTLS-SRTP
  (`src/media/dtls_srtp_transport.{h,cpp}`, on dhtnet's `TlsSession`) and
  `SocketPair`'s mux mode (RTP and RTCP on one transport, SRTCP). As a
  `SIPCall` it keeps the media pipelines, audio routing, conferences, mute
  and client signals: the apps see an ordinary call and need no change.
- `WebCallSignaling` (`src/jamidht/web_call_signaling.{h,cpp}`), one per
  Jami account, takes the five call messages in `JamiAccount::handleMessage`
  (clients no longer get them as `IncomingAccountMessage`).
- `LIBJAMI_FLAG_NO_WEB_CALLS` leaves the messages to the app: the web
  client's server sets it, as its browsers make the calls. Daemons without
  local media and the iOS notification extension leave them too.

## Call flows

**Web calls native (one-to-one).** The browser invites; the native device
checks the sender and its membership and rings with an incoming call. On
answer it sends onCallJoin, the browser offers, the daemon answers
(`a=setup:active`: it is the DTLS client), ICE connects, the DTLS handshake
checks the fingerprint, and the SRTP keys start the RTP sessions.

**Native calls web (one-to-one).** Calling a contact with a one-to-one
conversation rings their devices by SIP as before and also invites their
browsers (`native: true`). The first to answer gets the call: a device (the
SIP subcall merges, the browsers get onCallExit) or a browser (onCallJoin:
the SIP subcalls are hung up and the daemon offers to the browser,
`a=setup:actpass`, ICE controlling).

**Group call started in a browser (mesh).** A native member rings with a
call from the inviter. On answer it sends onCallJoin to every member; each
member in the call offers, and members who join later get an offer from the
daemon. The device keeps one leg per member, in a local conference
(`Manager::joinParticipant`, `addSubCall`) that sends each leg the device's
own camera and microphone, not the mix (`Call::isMeshLeg`,
`VideoRtpSession::setLocalSenderInConference`): every member gets the
others' media directly. When its last leg ends, the device sends onCallExit.

**Group call started on a native app (hosted).** The device hosts the
conference as the apps do for group conversations
(`ConversationModule::hostConference`) and invites the members' browsers
(`native: true, hosted: true`). A browser that answers connects to the host
alone and gets the mix, like the native members who join by SIP; it ignores
the other members' joins and offers, and the call ends when the host ends it.

## Security

1. The sender of a call message is the account the daemon authenticated
   (its certificate chain), and it must equal `data.senderId`: otherwise
   the message is dropped. The jami-web server checks the same when its
   daemon binding gives the sender.
2. The sender must be a member (or admin) of `conversationId` on this
   account; otherwise the message is dropped.
3. DTLS: the peer certificate must match the `a=fingerprint` (SHA-256) of
   the authenticated description. Each leg has a fresh ECDSA P-256
   certificate. Certificates that name an OCSP responder are refused, so a
   peer cannot make the daemon fetch a URL of its choice.
4. SRTP: SRTP_AES128_CM_HMAC_SHA1_80 keys from the DTLS exporter (RFC 5764);
   RTP and RTCP both protected; packets that fail authentication dropped.
5. Bounds: at most 8 legs per group call; ICE credentials of 4-64 and
   22-256 characters (pjnath copies them into a 128-byte stack buffer: a
   longer one would overflow it); candidates must be IP literals (no DNS
   lookups chosen by the peer); bounded queues of candidates and early
   packets; timeouts for ringing, ICE and DTLS; malformed SDP or JSON is
   dropped.

Fixed on the way:
- jami-web forwarded any `application/json` account message whose type was
  a WebSocket message type to the browser, so a peer could forge any server
  event, and a message that was not JSON stopped the server. It now forwards
  only the five call messages, from members, naming the authenticated
  sender.
- The daemon's Node.js binding passed the message ID as the sender of
  `IncomingAccountMessage` (upstream bug too).

## Reliability

- The message engine counts a message to an account sent once one device
  has it, so invites, joins and exits go to each device of the account, and
  descriptions to the device of the peer's session.
- The messages of one peer about one conversation are handled in order; the
  peer session of an earlier call is retired (a late exit does not end a
  redial).
- An answered call does not go back to ringing (`Call::setState`): a
  browser that answers first gets the call and the devices' SIP calls are
  cancelled; a device that answers tells its own other devices (they stop
  ringing).
- A peer that leaves without a word ends the call: DTLS close_notify, or
  nothing received for 30 s.
- Hold with a browser is local (no renegotiation): this side stops sending
  and playing.
- The browser's first key frame can arrive before the RTP session is set up:
  the DTLS-SRTP transport keeps up to 256 packets until it attaches; key
  frame requests are coalesced to one per 500 ms.

## Limitations

- Renegotiation is answered with the media in use: a browser's new m-lines
  (a screen share) are declined, ICE restarts are not supported, a changed
  direction is not applied.
- In mux mode, RTCP is read by the receiver thread: a send-only stream does
  not see the browser's key frame requests.
- Plugins do not process web legs' media.
- A web-started mesh and a native-hosted call in the same conversation at
  the same time stay two calls.
- The web client's server runs upstream's prebuilt daemon addon
  (`@savoirfairelinux/jami-core` 0.5.2), which can lose an account message
  sent before it has a connection to the peer (the first call after its
  restart may not ring), and whose binding does not give the sender. Built
  from kool277/jami-daemon, it would do neither.

## Rollout

Native users need the daemon of this change: new desktop, Android and iOS
releases (they build against the workspace's `jami-daemon` pin on `v*`
tags). Web users need the jami-web release with `kool277/native-calls`.
Older native apps keep working with each other; they just do not ring for
browsers, as before.

## Tests

Unit tests (in the daemon's Jenkins smoke tests): `socket_pair_mux`,
`dtls_srtp_transport`, `webrtc_sdp` (with descriptions captured from Chrome
and Firefox), `web_call_signaling`; `CallTest::testCallBetweenContacts`
(needs the public DHT). jami-web: client and server unit tests for the call
messages, late invites and hosted calls.

End to end on jami-server (2026-10-23): browsers in Playwright (Chromium and
Firefox, fake camera and microphone; the deployed web client swapped for a
test image), native devices = the daemon of this change in containers
(frank; a native device of bob for multi-device), driven over D-Bus with a
real video source; checks read WebRTC statistics in the browsers and the
daemon's decoder signals.

| Check | Result |
|---|---|
| One-to-one, browser calls native and native calls browser, Chrome and Firefox | Audio and video both ways, RTCP receiver reports; first frame about 0.5 s after connecting; hang up from either side and decline work |
| A user with a browser and a native device | Both ring; the first to answer gets the call, the other stops ringing |
| Group call started in the browser, native member joins before or after the other browsers | A conference forms on the native device; the browsers get its camera (640x480), it gets theirs; it can leave and the others go on |
| Group call hosted by a native device | The browsers ring, each connects to the host alone and gets the 1280x720 mix and audio; the call ends for them when the host ends it |
| Browser tab killed mid-call | The native side ends the call 31 s later |
