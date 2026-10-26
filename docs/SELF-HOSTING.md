# What a complete self-hosted Jami still needs

Status on 2026-10-24 (platform v1.5.1), jami-server at 192.168.1.92.

## In place

- **Accounts:** JAMS for accounts, devices, name lookups and policies (`docs/SERVER-SETUP.md`).
- **Server stack:** Caddy for HTTPS, coturn for TURN, and an OpenDHT node with a DHT proxy, all from `deploy/`.
- **Web client:** in the same stack, signed in with JAMS accounts.
- **Calls between all apps:** the web client, desktop, Android and iOS call each other, one-to-one and in groups. The daemon speaks the browser's WebRTC, end to end encrypted (`docs/WEBRTC-CALLS.md`).
- **CI and releases:**
  - Jenkins builds every component; iOS builds on GitHub Actions.
  - Each platform release (`RELEASING.md`) publishes the daemon, desktop (Linux), Android (signed APKs), iOS (unsigned .ipa), web, JAMS and plugins-store releases.

## Still to do, most important first

### 1. Reachability from outside the LAN

Today JAMS, the web client and TURN answer on the LAN only, with a certificate from Caddy's own CA. Phones on mobile data, and anyone at another site, cannot sign in or relay calls. The Android and iOS apps cannot sign in to JAMS even on the LAN: they trust only the CAs bundled in the app, not one installed on the phone (`docs/SERVER-SETUP.md`, TLS). The phone apps need this whole section.

- **DNS:** create names for JAMS and the web client, pointing to the public IP (`dechat.systemhost.uz` already serves Jenkins).
- **Port forwarding** on the router (192.168.1.5) to 192.168.1.92:
  - 443/tcp (JAMS, and the web client if it gets its own name);
  - 3479/udp+tcp and 49160-49200/udp (TURN);
  - 4222/udp (DHT) and 8000/tcp (DHT proxy).
- **Let's Encrypt** instead of the internal CA: set `JAMS_TLS` to an e-mail address (`docs/SERVER-SETUP.md`, TLS). Devices then trust the server without installing `jams-root.crt`.
- **TLS passthrough:** `dechat.systemhost.uz` is not served by this VM's Caddy or nginx, so another proxy answers on the public 443. If the JAMS name goes through that proxy, it must pass the TLS connection to Caddy unchanged, routed by SNI, without terminating it. Devices sign in to JAMS with a client certificate, which a terminating proxy drops.
- **`TURN_EXTERNAL_IP`:** set it to the public IP. Add TURN over TLS (`turns:`, 5349) for networks that block UDP.

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

- **Test accounts:** remove the JAMS test users (alice, bob, carol, dave, erin, frank, gina) and their devices before real use, including the native test device of bob. If any stay, change `JAMS_TEST_PASSWORD`: it appeared once in a tool output on 2026-10-19.
- **Directory:** connect JAMS to your LDAP or Active Directory if you have one.
- **Firewall:** ufw is disabled on the VM. Allow only the ports above, plus SSH.
- **Jenkins:** it is public at https://dechat.systemhost.uz. Put it behind a VPN or an IP allowlist, or move CI to another machine. Builds share this server's memory, and the server was OOM-killed during builds before.

### 5. Operations

- **Backups:** back up the JAMS volume (`jami_jams-data`: database, CA keys), Caddy's data, `deploy/.env`, the Jenkins home and `~/secure`. Test a restore.
- **Boot:**
  - Reserve 192.168.1.92 in DHCP. After a reboot the VM first gets 192.168.1.155; coturn binds that address and TURN fails until `docker compose restart coturn` (needed again today).
  - The host's own `coturn.service` (3478) has the same stale bind. Restart it after boot, or stop it if unused: the stack runs its own coturn on 3479.
  - Both restarts on 2026-10-24 were crashes, not shutdowns. Before the first, memory ran out. Before the second, the VM's disk and network stopped at 14:26, and nothing written after that was kept: the system log ends there, and a Jenkins workspace came back as empty files. Check the hypervisor (its storage, any backup or snapshot job at that time), and shut the VM down from inside before changing its hardware.
- **Updates:** today an unattended upgrade of Docker restarted every container, the stack included. Plan update windows, or hold the docker packages and update them by hand.
- **Monitoring:** add disk, memory and service health alerts.

### 6. Optional

- **A closed network:** the DHT node bootstraps from `bootstrap.jami.net`, so this server is part of the public Jami network. For a closed network, run your own bootstrap and point the JAMS blueprint at it; you can then no longer reach Jami users outside it.
- **The web client's daemon:** jami-web runs upstream's prebuilt daemon (`@savoirfairelinux/jami-core` 0.5.2). Built from kool277/jami-daemon, it would no longer lose a message sent before it has a connection to the peer, and the web server could check who sent each call message.
