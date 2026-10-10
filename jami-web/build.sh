#!/bin/sh

# This script assumes that all daemon dependencies have been successfully installed.
# If they are not, please visit https://git.jami.net/savoirfairelinux/jami-daemon/ for further information.

# ===========Building daemon===============
echo "Building daemon …"
git submodule update --init --recursive
cd daemon
mkdir build
cd build
cmake .. -DJAMI_NODEJS=ON -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release -DCMAKE_INTERPROCEDURAL_OPTIMIZATION=ON -GNinja
ninja
cd ..
cd ..
npm run pack-native --workspace=@savoirfairelinux/jami-core

# ============Cleaning the app==============
echo "Cleaning the app…"
npm run clean:all

# =======Installing node dependencies=======
echo "Installing node dependencies…"
npm install

# ============Building the app==============
echo "Building the app…"
npm run build

echo "Copying files to production folder…"

mkdir jami-web-production jami-web-production/client jami-web-production/server jami-web-production/common jami-web-production/daemon jami-web-production/daemon/bin jami-web-production/daemon/bin/nodejs

cp -r server/dist jami-web-production/server
cp -r common/dist jami-web-production/common
cp -r client/dist jami-web-production/client
cp -r daemon/bin/nodejs/dist jami-web-production/daemon/bin/nodejs
cp -r daemon/bin/nodejs/npm jami-web-production/daemon/bin/nodejs

cp package*.json jami-web-production
cp server/package*.json jami-web-production/server
cp common/package*.json jami-web-production/common
cp client/package*.json jami-web-production/client
cp daemon/bin/nodejs/package*.json jami-web-production/daemon/bin/nodejs

cp server/tsconfig.tsbuildinfo jami-web-production/server
cp client/tsconfig.tsbuildinfo jami-web-production/client
cp common/tsconfig.tsbuildinfo jami-web-production/common

cp -r server/scripts jami-web-production/server 2>/dev/null || true
cp server/.env jami-web-production/server

cp install.sh jami-web-production
cp jami-web.service jami-web-production

echo "Creating archive…"
tar -czvf jami-web.tar.gz jami-web-production