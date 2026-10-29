#!/bin/sh
# JAMS reads and writes its state (Derby DB "jams/", config.json,
# oauth.key/pub, CA.pem, jams.crl, images/) in its working directory,
# next to its jars. Run it from the persistent volume and refresh the
# program files from the image on every start, so upgrading the image
# upgrades JAMS without touching its data.
#
# Cap the heap at 2 GB; JAMS keeps about 350 MB live. Without a cap the
# JVM takes up to a quarter of the host's memory and keeps it: JAMS
# reached 12 GB, mostly garbage from its update check, which read all
# its jars (200 MB) every 2 minutes before v3.8-kool277.3.
# JDK_JAVA_OPTIONS also reaches jams-server.jar, which jams-launcher.jar
# starts as a second java process. If the heap runs out, JAMS exits and
# Docker restarts it.
set -eu

data=/home/jams/data
mkdir -p "$data"
cp -a /app/jams/. "$data/"
cd "$data"
export JDK_JAVA_OPTIONS="-Xmx2g -XX:+ExitOnOutOfMemoryError"
exec java -jar jams-launcher.jar
