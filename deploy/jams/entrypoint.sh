#!/bin/sh
# JAMS reads and writes its state (Derby DB "jams/", config.json,
# oauth.key/pub, CA.pem, jams.crl, images/) in its working directory,
# next to its jars. Run it from the persistent volume and refresh the
# program files from the image on every start, so upgrading the image
# upgrades JAMS without touching its data.
set -eu

data=/home/jams/data
mkdir -p "$data"
cp -a /app/jams/. "$data/"
cd "$data"
exec java -jar jams-launcher.jar
