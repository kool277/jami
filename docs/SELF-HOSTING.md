# What a complete self-hosted Jami still needs

Status on 2026-10-29 (platform v1.6.2), jami-server at 192.168.1.92.

## In place

- **Accounts:** JAMS for accounts, devices, name lookups and policies (`docs/SERVER-SETUP.md`).
- **Server stack:** Caddy for HTTPS, coturn for TURN, and an OpenDHT node with a DHT proxy, all from `deploy/`.
- **Web client:** in the same stack, signed in with JAMS accounts.
- **Access from the internet:** JAMS at `https://jams.jaybi.uz:9443`, the web client and the apps page at `https://jams.jaybi.uz:8443`, TURN and the DHT proxy, through ports the router forwards. The certificate comes from Let's Encrypt, and the phone apps trust it (`docs/SERVER-SETUP.md`, Access from the internet). On 2026-10-29 the web client and JAMS answered from outside the LAN.
- **Calls between all apps:** the web client, desktop, Android and iOS call each other, one-to-one and in groups. The daemon speaks the browser's WebRTC, end to end encrypted (`docs/WEBRTC-CALLS.md`).
- **CI and releases:**
  - Jenkins builds every component; iOS builds on GitHub Actions.
  - Each platform release (`RELEASING.md`) publishes the daemon, desktop (Linux), Android (signed APKs), iOS (unsigned .ipa), web, JAMS and plugins-store releases.

## Still to do, most important first

### 1. Calls from outside the LAN

The server answers from the internet (see "In place"). Not tried from outside yet: a call, the first real use of TURN through the router, and the phone apps' sign-in on port 9443.

- **TURN over TLS** (`turns:`) for networks that let only HTTPS out. The router keeps 443 for its other sites, so coturn needs another forwarded port (5349) and the certificate.
- **Relays:** the router does not pass traffic for its public address back in, so a call where neither side can reach the other except through this server's relays fails (`docs/SERVER-SETUP.md`, TURN behind the router). Hairpin NAT on the router, which passes LAN traffic for 5.133.122.43 back to this host, would remove that limit.

### 2. Push notifications for phones

Without push, a phone only rings while the app runs. Use the `noPush` APK, which keeps a background connection. The DHT proxy (`dhtnode --proxyserver`) has no push gateway configured.

- **Android without Google:**
  - the `withUnifiedPush` APK;
  - a UnifiedPush distributor on the phone, such as ntfy, whose server can be self-hosted;
  - a push gateway configured in the DHT proxy.
- **Android with Google:** your own Firebase project. Build with its `google-services.json` and give its FCM credentials to the push gateway (for example gorush, set with `--pushserver`).
- **iOS:**
  - the Apple Developer Program ($99 per year);
  - your own bundle ID with the push entitlement;
  - an APNs key in the push gateway.

### 3. App signing, identity and packaging

- **Android:**
  - The APKs are signed with the key in `~/secure` on jami-server: `jami-release.jks` and `jami-release.password`. Keep an offline backup of both. Without that key, an update cannot install over the app, and every user has to uninstall and reinstall.
  - The apps keep upstream's identity (Android `cx.ring`). Installing over the official Jami app fails until it is uninstalled.
- **iOS:** the `.ipa` is unsigned.
  - Testing: sign it with your Apple ID through Xcode, Sideloadly or AltStore. The certificate lasts 7 days, and push and some extensions do not work.
  - Distributing (TestFlight, App Store): needs the Apple Developer Program and your own bundle ID.
- **Desktop:** the release is a Linux x86_64 archive that needs Qt 6.12.0 in `/opt/qt/6.12.0/gcc_64`. Still missing:
  - Linux packages (.deb, AppImage or Flatpak) with Qt bundled;
  - a Windows installer;
  - a signed and notarized macOS .dmg.
- **Branding:** "Jami" and its logo belong to Savoir-faire Linux. To give the apps to people outside your organization, use your own name, logo and app IDs.

### 4. Accounts and hardening

- **Test accounts:** remove the JAMS test users (alice, bob, carol, dave, erin, frank, gina) and their devices before real use, including bob's native test device and gina's phone-style test device. They can sign in from the internet now. Their password was last changed on 2026-10-26 (`JAMS_TEST_PASSWORD`, applied by `scripts/jams-setup.sh`).
- **Directory:** connect JAMS to your LDAP or Active Directory if you have one.
- **Firewall:** ufw is disabled on the VM; from the internet, only the ports the router forwards reach it. Before turning ufw on, allow those (`docs/SERVER-SETUP.md`, Access from the internet), SSH, 443 (JAMS administration, LAN), 8080 and 8081 (Jenkins and Let's Encrypt, through the router's proxy), and the VM's other services: nginx (80), PostgreSQL (5432, listening on every address), Asterisk (5060, 4569) and the host's coturn (3478).
- **Jenkins:** it is public at https://dechat.systemhost.uz. Put it behind a VPN or an IP allowlist, or move CI to another machine. Builds share this server's memory, and the server was OOM-killed during builds before.

### 5. Operations

- **Backups:** back up the JAMS volume (`jami_jams-data`: database, CA keys), Caddy's data, `deploy/.env`, the Jenkins home and `~/secure`. Test a restore.
- **Boot:**
  - 192.168.1.92 is reserved in the router's DHCP since 2026-10-28. Before that, the VM first got 192.168.1.155 after a reboot; coturn bound that address, and TURN failed until `docker compose restart coturn`.
  - The host's own `coturn.service` (3478) has the same stale bind. Restart it after boot, or stop it if unused: the stack runs its own coturn on 3479.
  - Both restarts on 2026-10-24 were crashes, not shutdowns. Before the first, memory ran out. Before the second, the VM's disk and network stopped at 14:26, and nothing written after that was kept: the system log ends there, and a Jenkins workspace came back as empty files. Check the hypervisor (its storage, any backup or snapshot job at that time), and shut the VM down from inside before changing its hardware.
- **Updates:** on 2026-10-24 an unattended upgrade of Docker restarted every container, the stack included. Plan update windows, or hold the docker packages and update them by hand.
- **Monitoring:** add disk, memory and service health alerts.

### 6. Optional

- **A closed network:** the DHT node bootstraps from `bootstrap.jami.net`, so this server is part of the public Jami network. For a closed network, run your own bootstrap and point the JAMS blueprint at it; you can then no longer reach Jami users outside it.
- **The web client's daemon:** jami-web runs upstream's prebuilt daemon (`@savoirfairelinux/jami-core` 0.5.2). Built from kool277/jami-daemon, it would no longer lose a message sent before it has a connection to the peer, and the web server could check who sent each call message.
