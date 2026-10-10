# Deploy Jami Web

This guide explains how to run Jami Web in production. Jami Web is a single
Express server that embeds the Jami daemon and serves the React client. It is
published to npm as [`@savoirfairelinux/jami-web`](https://www.npmjs.com/package/@savoirfairelinux/jami-web)
and ships a `jami-web` command-line tool.

## Choose a deployment method

| Method                          | Best for                                                                      | Native daemon                              | Effort | Upgrades        |
| ------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ | ------ | --------------- |
| **npm (global install)**        | Most production deployments on Linux x64/arm64                                | Downloaded automatically for your platform | Low    | `npm update -g` |
| **Docker / Compose**            | Hosts without the build dependencies, or where you prefer container isolation | Built from the daemon submodule            | Medium | rebuild image   |
| **From source (build locally)** | Development, custom daemon builds, unsupported platforms                      | Built locally with CMake/Ninja             | High   | rebuild         |

**Recommendation:** use the **npm global install** behind a reverse proxy with a
systemd service. It is the simplest path, gets the prebuilt native daemon
automatically, and upgrades cleanly through npm. Use Docker if you cannot
install Node.js 22 on the host or want container isolation.

In every case Jami Web listens on a single HTTP port (default `8080`) and should
be placed behind a TLS-terminating reverse proxy (nginx, Apache, Caddy, …).

---

## Method 1 — npm (recommended)

### 1. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt-get install -y nodejs
node -v   # should print v22.x
```

### 2. Install Jami Web

```bash
sudo npm install -g @savoirfairelinux/jami-web
```

This installs the `jami-web` command and pulls in `@savoirfairelinux/jami-core`,
which automatically downloads the prebuilt native daemon for your platform
(`linux-x64` or `linux-arm64`).

### 3. Run the first-run setup

```bash
jami-web setup
```

The interactive wizard creates JWT signing keys, an admin account, and the
authentication configuration. For unattended/automated installs use the
non-interactive mode:

```bash
JAMI_WEB_ADMIN_PASSWORD='change-me' jami-web setup --non-interactive --enable-local
```

See `jami-web setup --help` for all flags.

### 4. Verify the installation

```bash
jami-web doctor
```

`doctor` checks the data directory, signing keys, admin account, native daemon
module, and port availability, and exits non-zero if anything is wrong. Use
`jami-web config` to print the resolved data directory, env file path, and the
effective runtime settings (environment, port, host).

### 5. Run it

```bash
jami-web            # starts in production mode on port 8080
PORT=8081 jami-web  # override the port
```

To start Jami Web now and automatically after login:

```bash
jami-web install
```

On Linux this installs a systemd user service. On macOS it installs a
LaunchAgent. Run the command as the user who should run Jami Web; do not use
`sudo`.

On Linux, install a system-wide service that starts at boot instead:

```bash
sudo jami-web install --global
```

The installer creates a locked `jami-web` system account and stores its
persistent data under `/var/lib/jami-web`. Uninstalling the service preserves
the account and its data.

---

## Method 2 — Docker / Compose

> **WARNING:** Data is stored in Docker volumes and persists across container
> recreations unless you delete the volumes manually. Proceed with caution.

### Install Docker

```bash
# Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Build and run

From the repository root:

```bash
docker compose up --build -d
```

The application is now running on port `8080`. Set up a reverse proxy as
described in [Reverse proxy (TLS)](#reverse-proxy-tls).

### Data location

By default the container stores its data in named volumes. You can point the
Jami Web data volume at a host directory by setting `JAMI_WEB_DATA_DIR` before
running compose:

```bash
JAMI_WEB_DATA_DIR=/srv/jami-web/data docker compose up --build -d
```

Run the first-run setup inside the container:

```bash
docker compose exec jami-web jami-web setup
```

---

## Method 3 — From source

Use this only for development or to build a custom daemon. See the
[README](./README.md) for the full build steps (submodules, daemon build with
CMake/Ninja, and packaging the native addon). Once built, you can run the
compiled server with `node server/dist/index.js`.

---

## Running as a startup service

A managed service ensures Jami Web restarts on failure and starts when the user
logs in. Install and start the service with:

```bash
jami-web install
```

Linux writes `~/.config/systemd/user/jami-web.service` and enables it with
`systemctl --user`. macOS writes
`~/Library/LaunchAgents/net.jami.web.plist` and loads it with `launchctl`.
Re-running the command updates and restarts the installed service.

Stop and remove the service with:

```bash
jami-web uninstall
```

For a system-wide Linux installation, use:

```bash
sudo jami-web uninstall --global
```

---

## Reverse proxy (TLS)

Terminate TLS at a reverse proxy and forward to the Jami Web port. WebSocket
upgrade headers are required. Example nginx configuration:

```nginx
server {
    listen 80;
    server_name jami.example.com;
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name jami.example.com;

    ssl_certificate     /etc/ssl/certs/your_ssl_certificate.crt;
    ssl_certificate_key /etc/ssl/private/your_key.key;

    location / {
        proxy_pass http://localhost:8080;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/jami.example.com.access.log;
    error_log  /var/log/nginx/jami.example.com.error.log;
}
```

Apache, Caddy, or any other reverse proxy work equally well as long as port
`443` is forwarded to the application port and WebSocket upgrades are passed
through.

---

## Backups

All persistent state lives in the Jami Web data directory. Find it with:

```bash
jami-web config
```

It contains:

- `.env` — JWT signing keys (back this up; losing it invalidates all sessions)
- `admin.json` — admin account and server configuration
- `accounts.json` — managed accounts
- `passkeys.json` — registered passkeys
- `uploads/` — uploaded files

Back up the entire data directory (and, for Docker, the `jami-data` volume which
holds the daemon account state). Stop the service for a consistent snapshot, or
use filesystem snapshots.

---

## Upgrades

- **npm:** `sudo npm update -g @savoirfairelinux/jami-web && sudo systemctl restart jami-web`
- **Docker:** rebuild with `docker compose up --build -d`

After upgrading, run `jami-web doctor` to confirm the installation is healthy.

---

## Troubleshooting

Run `jami-web doctor` first — it diagnoses the most common problems.

| Symptom                               | Cause / fix                                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Port 8080 is already in use`         | Another process holds the port. Stop it or set `PORT=<port>`.                                      |
| `Port … requires elevated privileges` | Ports below 1024 are privileged. Use a port ≥ 1024 and proxy to it.                                |
| `Invalid PORT value`                  | `PORT` must be a number, e.g. `PORT=8080`.                                                         |
| `Incomplete JWT signing keys`         | Only one of `PRIVATE_KEY`/`PUBLIC_KEY` is set. Run `jami-web genkeys --force`.                     |
| Native daemon fails to load           | Wrong platform package or missing system libraries. Reinstall on a supported Linux x64/arm64 host. |
| Cannot log in / sessions reset        | The `.env` signing keys changed. Restore the backed-up `.env`.                                     |

Check the service logs with `journalctl -u jami-web -f` (systemd) or
`docker compose logs -f jami-web` (Docker).
