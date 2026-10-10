#!/bin/sh
# Default installation on a debian based system

# Warning: This script requires root privileges to
# install dependencies and configure the service/user.
#
# The following variables can be overridden via the environment:
#   JAMI_WEB_INSTALL_DIR  Install location           (default: /opt/jami-web)
#   JAMI_WEB_USER         Service user               (default: jamid)
#   JAMI_WEB_GROUP        Service group              (default: same as user)
#   JAMI_WEB_DATA_DIR     Data directory             (default: $INSTALL_DIR/data)

INSTALL_DIR="${JAMI_WEB_INSTALL_DIR:-/opt/jami-web}"
SERVICE_USER="${JAMI_WEB_USER:-jamid}"
SERVICE_GROUP="${JAMI_WEB_GROUP:-$SERVICE_USER}"
DATA_DIR="${JAMI_WEB_DATA_DIR:-$INSTALL_DIR/data}"

echo "Installing Jami Web"
echo "  Install dir: $INSTALL_DIR"
echo "  Service user: $SERVICE_USER:$SERVICE_GROUP"
echo "  Data dir:    $DATA_DIR"

# ===========Installing dependencies===============

echo "Installing dependencies…\n"

sudo apt-get update
sudo apt install autoconf automake autopoint bison libsecp256k1-1 build-essential cmake curl git nasm pkg-config yasm nodejs npm -y

npm install -g node-gyp
npm install

# ===========Setting up the application =============

echo "\nSetting up the service…"

# Render the systemd unit with the configured paths/user.
sudo tee /etc/systemd/system/jami-web.service > /dev/null << EOF
[Unit]
Description=Jami Web Service
After=network.target network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/server
ExecStart=/usr/bin/node ${INSTALL_DIR}/server/dist/index.js
Restart=always
RestartSec=10
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
Environment=NODE_ENV=production
Environment=JAMI_WEB_DATA_DIR=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

cd ..
sudo mv jami-web-production "$INSTALL_DIR"

sudo useradd -m -d "$DATA_DIR" "$SERVICE_USER" 2>/dev/null || true
sudo mkdir -p "$DATA_DIR"

sudo chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
sudo chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DATA_DIR"

sudo systemctl daemon-reload
sudo systemctl enable jami-web.service
sudo systemctl start jami-web.service

echo "\nInstallation successfully completed!"
echo "Jami Web is now active and running on port 8080 on the system."